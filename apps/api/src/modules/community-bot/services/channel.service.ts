import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { prisma } from "@creator-hub/database";
import { CredentialCipher } from "@creator-hub/community-bot";
import {
  COMMUNITY_CHANNEL_COMMAND_QUEUE,
  type CommunityChannelCommand,
} from "@creator-hub/shared-types";

const TELEGRAM_API_TIMEOUT_MS = 8000;

/** Fields safe to expose to the frontend — never the credentials. */
const CHANNEL_PUBLIC_SELECT = {
  id: true,
  type: true,
  status: true,
  externalIdentity: true,
  lastConnectedAt: true,
  lastError: true,
  createdAt: true,
} as const;

/**
 * Manages channel lifecycle from the API side: validates and stores
 * encrypted credentials, then delegates the actual connection to the
 * community-worker via the commands queue (the API stays stateless).
 */
@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    @InjectQueue(COMMUNITY_CHANNEL_COMMAND_QUEUE)
    private readonly commandQueue: Queue<CommunityChannelCommand>,
  ) {}

  async list(userId: string) {
    return prisma.communityChannel.findMany({
      where: { userId },
      select: CHANNEL_PUBLIC_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async connectTelegram(userId: string, botToken: string) {
    const identity = await this.validateTelegramToken(botToken);

    const cipher = CredentialCipher.fromEnv();
    const encrypted = cipher.encryptJson({ botToken });

    const channel = await prisma.communityChannel.upsert({
      where: { userId_type: { userId, type: "TELEGRAM" } },
      create: {
        userId,
        type: "TELEGRAM",
        status: "CONNECTING",
        credentials: encrypted,
        externalIdentity: identity,
      },
      update: {
        status: "CONNECTING",
        credentials: encrypted,
        externalIdentity: identity,
        lastError: null,
      },
      select: CHANNEL_PUBLIC_SELECT,
    });

    await this.enqueueCommand({
      action: "CONNECT",
      channelId: channel.id,
      userId,
      channelType: "TELEGRAM",
    });

    return channel;
  }

  async disconnect(
    userId: string,
    type: "TELEGRAM" | "WHATSAPP" | "INSTAGRAM",
  ) {
    const channel = await prisma.communityChannel.findUnique({
      where: { userId_type: { userId, type } },
    });
    if (!channel) {
      throw new NotFoundException(`No ${type} channel configured`);
    }

    await this.enqueueCommand({
      action: "DISCONNECT",
      channelId: channel.id,
      userId,
      channelType: type,
    });

    // Optimistic: the worker confirms via its own status update, but the
    // UI should not wait on the round trip to reflect the intent.
    return prisma.communityChannel.update({
      where: { id: channel.id },
      data: { status: "DISCONNECTED" },
      select: CHANNEL_PUBLIC_SELECT,
    });
  }

  /**
   * Stateless token check against the Telegram Bot API — no connector
   * instance needed, just a getMe call with a hard timeout.
   */
  private async validateTelegramToken(botToken: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TELEGRAM_API_TIMEOUT_MS,
    );

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getMe`,
        { signal: controller.signal },
      );
      const body = (await response.json()) as {
        ok: boolean;
        result?: { username?: string };
      };

      if (!body.ok || !body.result) {
        throw new BadRequestException(
          "Telegram rejected this bot token — check it with @BotFather",
        );
      }

      return body.result.username ? `@${body.result.username}` : "unknown";
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `Telegram token validation failed: ${(error as Error).message}`,
      );
      throw new BadRequestException(
        "Could not reach Telegram to validate the token — try again",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async enqueueCommand(
    command: CommunityChannelCommand,
  ): Promise<void> {
    await this.commandQueue.add("channel-command", command, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86400 },
    });
  }
}
