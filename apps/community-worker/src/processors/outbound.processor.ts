import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { prisma } from "@creator-hub/database";
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from "@creator-hub/domain-events";
import {
  COMMUNITY_REPLY_SENT_EVENT,
  type CommunityOutboundJob,
  type CommunityReplySentEvent,
} from "@creator-hub/shared-types";
import { ChannelManagerService } from "../channel-manager.service";

/**
 * Delivers generated replies through the live channel connector. A small
 * randomized delay keeps interactions human-paced (important for
 * unofficial WhatsApp clients in phase 2, harmless for Telegram).
 */
@Processor("community-outbound")
export class OutboundProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboundProcessor.name);

  constructor(
    @Inject(ChannelManagerService)
    private readonly channelManager: ChannelManagerService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {
    super();
  }

  async process(job: Job<CommunityOutboundJob>): Promise<void> {
    const data = job.data;
    this.logger.log(
      `[Outbound] Delivering reply to ${data.externalUserId} on channel ${data.channelId}...`,
    );

    await this.humanDelay();

    const connector = await this.channelManager.getOrReconnect(data.channelId);
    this.logger.log(`[Outbound] Connector ready, sending message...`);
    await connector.sendMessage(data.externalUserId, data.text);
    this.logger.log(`[Outbound] Message sent to ${data.externalUserId}`);

    const message = await prisma.communityMessage.update({
      where: { id: data.outboundMessageId },
      data: { status: "SENT" },
      include: { conversation: { select: { id: true } } },
    });

    const event: CommunityReplySentEvent = {
      userId: data.userId,
      channelId: data.channelId,
      conversationId: message.conversation.id,
      messageId: message.id,
      creditsUsed: message.creditsUsed ?? 0,
      modelId: message.modelId ?? "unknown",
      timestamp: new Date(),
    };
    await this.events
      .publish(COMMUNITY_REPLY_SENT_EVENT, event)
      .catch(() => undefined);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<CommunityOutboundJob> | undefined, error: Error) {
    if (!job) return;
    if (job.attemptsMade < (job.opts.attempts ?? 1)) return;

    this.logger.error(
      `Outbound delivery permanently failed for message ${job.data.outboundMessageId}: ${error.message}`,
    );

    await prisma.communityMessage
      .update({
        where: { id: job.data.outboundMessageId },
        data: { status: "FAILED", skipReason: "delivery_failed" },
      })
      .catch(() => undefined);
  }

  private async humanDelay(): Promise<void> {
    const ms = 500 + Math.floor(Math.random() * 1000);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
