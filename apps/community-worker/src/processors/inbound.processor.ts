import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { Prisma, prisma } from "@creator-hub/database";
import { CreditService } from "@creator-hub/billing";
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from "@creator-hub/domain-events";
import {
  COMMUNITY_OUTBOUND_QUEUE,
  COMMUNITY_MESSAGE_RECEIVED_EVENT,
  COMMUNITY_REPLY_SKIPPED_EVENT,
  type CommunityInboundJob,
  type CommunityOutboundJob,
  type CommunityMessageReceivedEvent,
  type CommunityReplySkippedEvent,
} from "@creator-hub/shared-types";
import { CommunityGuardService } from "../services/community-guard.service";
import { ReplyGeneratorService } from "../services/reply-generator.service";

const DEFAULT_CREDIT_COST = 1;
const PREVIEW_LENGTH = 80;

/**
 * Consumes normalized channel messages and drives the full reply
 * pipeline: persist fan message → cost/abuse guards → style-profile RAG
 * generation → credit deduction → enqueue delivery.
 */
@Processor("community-inbound")
export class InboundProcessor extends WorkerHost {
  private readonly logger = new Logger(InboundProcessor.name);

  constructor(
    @InjectQueue(COMMUNITY_OUTBOUND_QUEUE)
    private readonly outboundQueue: Queue<CommunityOutboundJob>,
    @Inject(CommunityGuardService)
    private readonly guardService: CommunityGuardService,
    @Inject(ReplyGeneratorService)
    private readonly replyGenerator: ReplyGeneratorService,
    @Inject(CreditService) private readonly creditService: CreditService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {
    super();
  }

  async process(job: Job<CommunityInboundJob>): Promise<void> {
    const data = job.data;

    const channel = await prisma.communityChannel.findUnique({
      where: { id: data.channelId },
    });
    const config = await prisma.communityBotConfig.findUnique({
      where: { userId: data.userId },
    });

    if (!channel || channel.status !== "ACTIVE") {
      this.logger.warn(
        `Dropping inbound message: channel ${data.channelId} missing or not ACTIVE`,
      );
      return;
    }

    // Fan messages are always persisted (even when a guard rejects the
    // reply) so the creator sees the full conversation in the UI.
    const contact = await this.upsertContact(data);
    const conversation = await this.upsertConversation(
      data.channelId,
      contact.id,
    );

    const inbound = await this.persistInboundMessage(
      conversation.id,
      data,
    ).catch((error: unknown) => {
      // Unique (conversationId, externalMessageId) violation: the message
      // was already processed by a concurrent/duplicate delivery.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return null;
      }
      throw error;
    });

    if (!inbound) {
      this.logger.log(
        `Duplicate inbound message ignored: ${data.externalMessageId}`,
      );
      return;
    }

    await this.publishMessageReceived(data, conversation.id, inbound.id);

    const creditCost = await this.resolveCreditCost(config?.modelId);

    const verdict = await this.guardService.evaluate({
      userId: data.userId,
      isEnabled: config?.isEnabled ?? false,
      contactId: contact.id,
      contactIsBlocked: contact.isBlocked,
      contactLastReplyAt: contact.lastReplyAt,
      perContactCooldownSec: config?.perContactCooldownSec ?? 30,
      dailyReplyLimit: config?.dailyReplyLimit ?? 200,
      creditCost,
    });

    if (!verdict.allowed) {
      await prisma.communityMessage.update({
        where: { id: inbound.id },
        data: { status: "SKIPPED", skipReason: verdict.reason },
      });
      await this.publishReplySkipped(data, verdict.reason);
      return;
    }

    const reply = await this.replyGenerator.generate({
      userId: data.userId,
      conversationId: conversation.id,
      incomingText: data.text,
      config: {
        modelId: config!.modelId,
        temperature: config!.temperature,
        maxTokens: config!.maxTokens,
        historyLength: config!.historyLength,
        useStyleProfile: config!.useStyleProfile,
        systemPromptExtra: config!.systemPromptExtra,
      },
    });

    // Credits are deducted only after a successful generation: the AI
    // cost is real at that point, and failed generations never bill.
    const deducted = await this.creditService.deduct(
      data.userId,
      creditCost,
      undefined,
      `Community bot reply (${data.channelType})`,
    );
    if (!deducted) {
      // Balance changed between the guard check and the deduction.
      await prisma.communityMessage.update({
        where: { id: inbound.id },
        data: { status: "SKIPPED", skipReason: "insufficient_credits" },
      });
      await this.publishReplySkipped(data, "insufficient_credits");
      return;
    }

    const outbound = await prisma.communityMessage.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        content: reply.text,
        status: "PROCESSING",
        modelId: reply.modelId,
        tokensUsed: reply.tokensUsed,
        creditsUsed: creditCost,
      },
    });

    await prisma.$transaction([
      prisma.communityContact.update({
        where: { id: contact.id },
        data: { lastReplyAt: new Date() },
      }),
      prisma.communityConversation.update({
        where: { id: conversation.id },
        data: { messageCount: { increment: 2 }, lastMessageAt: new Date() },
      }),
    ]);

    await this.outboundQueue.add(
      "deliver-reply",
      {
        channelId: data.channelId,
        userId: data.userId,
        channelType: data.channelType,
        externalUserId: data.externalUserId,
        text: reply.text,
        outboundMessageId: outbound.id,
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400 },
      },
    );
  }

  private async upsertContact(data: CommunityInboundJob) {
    return prisma.communityContact.upsert({
      where: {
        channelId_externalId: {
          channelId: data.channelId,
          externalId: data.externalUserId,
        },
      },
      create: {
        channelId: data.channelId,
        externalId: data.externalUserId,
        username: data.username,
        displayName: data.displayName,
      },
      update: {
        username: data.username,
        displayName: data.displayName,
      },
    });
  }

  private async upsertConversation(channelId: string, contactId: string) {
    return prisma.communityConversation.upsert({
      where: { channelId_contactId: { channelId, contactId } },
      create: { channelId, contactId },
      update: {},
    });
  }

  private async persistInboundMessage(
    conversationId: string,
    data: CommunityInboundJob,
  ) {
    return prisma.communityMessage.create({
      data: {
        conversationId,
        direction: "INBOUND",
        externalMessageId: data.externalMessageId,
        content: data.text,
        status: "RECEIVED",
      },
    });
  }

  private async resolveCreditCost(modelId?: string): Promise<number> {
    if (!modelId) return DEFAULT_CREDIT_COST;
    const metadata = await prisma.modelMetadata.findFirst({
      where: { modelId, isActive: true },
      select: { creditCost: true },
    });
    return metadata?.creditCost ?? DEFAULT_CREDIT_COST;
  }

  private async publishMessageReceived(
    data: CommunityInboundJob,
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    const event: CommunityMessageReceivedEvent = {
      userId: data.userId,
      channelId: data.channelId,
      conversationId,
      messageId,
      contactName: data.displayName ?? data.username,
      preview: data.text.slice(0, PREVIEW_LENGTH),
      timestamp: new Date(),
    };
    await this.events
      .publish(COMMUNITY_MESSAGE_RECEIVED_EVENT, event)
      .catch(() => undefined);
  }

  private async publishReplySkipped(
    data: CommunityInboundJob,
    reason: CommunityReplySkippedEvent["reason"],
  ): Promise<void> {
    // Only creator-actionable reasons are pushed to the UI; cooldown and
    // blocked-contact skips are routine noise.
    if (reason !== "insufficient_credits" && reason !== "daily_limit") {
      return;
    }
    const event: CommunityReplySkippedEvent = {
      userId: data.userId,
      channelId: data.channelId,
      reason,
      timestamp: new Date(),
    };
    await this.events
      .publish(COMMUNITY_REPLY_SKIPPED_EVENT, event)
      .catch(() => undefined);
  }
}
