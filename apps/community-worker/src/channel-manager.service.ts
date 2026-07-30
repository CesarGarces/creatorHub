import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { prisma } from "@creator-hub/database";
import {
  DOMAIN_EVENT_PUBLISHER,
  type DomainEventPublisher,
} from "@creator-hub/domain-events";
import {
  CredentialCipher,
  TelegramConnector,
  WhatsAppConnector,
  type ChannelConnector,
  type NormalizedInboundMessage,
} from "@creator-hub/community-bot";
import {
  COMMUNITY_INBOUND_QUEUE,
  COMMUNITY_CHANNEL_STATUS_EVENT,
  type CommunityChannelStatusEvent,
  type CommunityChannelType,
  type CommunityInboundJob,
} from "@creator-hub/shared-types";

/**
 * Owns every live channel connection in this process, keyed by
 * CommunityChannel.id. Connections are rehydrated from the database on
 * startup so a worker restart restores all active bots without manual
 * intervention.
 */
@Injectable()
export class ChannelManagerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelManagerService.name);
  private readonly connectors = new Map<string, ChannelConnector>();

  constructor(
    @InjectQueue(COMMUNITY_INBOUND_QUEUE)
    private readonly inboundQueue: Queue<CommunityInboundJob>,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly events: DomainEventPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    const activeChannels = await prisma.communityChannel.findMany({
      where: { status: { in: ["ACTIVE", "CONNECTING"] } },
      select: { id: true, type: true },
    });

    if (activeChannels.length === 0) {
      this.logger.log("No active community channels to restore");
      return;
    }

    this.logger.log(`Restoring ${activeChannels.length} channel connection(s)`);
    // Reconnect sequentially: each Baileys/Telegram handshake is
    // rate-limited by the external platform, bursts risk bans.
    for (const channel of activeChannels) {
      await this.connectChannel(channel.id).catch((error) => {
        this.logger.error(
          `Failed to restore channel ${channel.id}: ${(error as Error).message}`,
        );
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const [channelId, connector] of this.connectors) {
      await connector.disconnect().catch((error) => {
        this.logger.warn(
          `Error disconnecting channel ${channelId}: ${(error as Error).message}`,
        );
      });
    }
    this.connectors.clear();
  }

  /**
   * Bring a channel online in this process. Reads credentials from the
   * DB (source of truth), builds the connector and wires its events to
   * the inbound queue and the status event bus.
   */
  async connectChannel(channelId: string): Promise<void> {
    const channel = await prisma.communityChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new Error(`Channel ${channelId} not found`);
    if (!channel.credentials) {
      throw new Error(`Channel ${channelId} has no credentials configured`);
    }

    // Replace any stale connection for this channel.
    await this.disconnectChannel(channelId);

    const cipher = CredentialCipher.fromEnv();
    const credentials = cipher.decryptJson(channel.credentials);
    const connector = this.createConnector(channel.type);

    this.connectors.set(channelId, connector);

    // For WhatsApp: set up session persistence callback
    if (connector instanceof WhatsAppConnector) {
      connector.setSessionUpdater(async (state) => {
        const encrypted = cipher.encryptJson(state);
        await prisma.communityChannel.update({
          where: { id: channelId },
          data: { credentials: encrypted },
        });
      });
    }

    try {
      const result = await connector.connect(credentials, {
        onMessage: (message) =>
          this.enqueueInbound(
            channel.id,
            channel.userId,
            channel.type,
            message,
          ),
        onStatusChange: (update) =>
          this.handleStatusChange(channel.id, channel.userId, channel.type, {
            status: update.status === "CONNECTED" ? "ACTIVE" : update.status,
            externalIdentity: update.externalIdentity,
            error: update.error,
          }),
        onQrCode: (qrDataUrl) =>
          this.handleQrCode(
            channel.id,
            channel.userId,
            channel.type,
            qrDataUrl,
          ),
      });

      await this.persistStatus(channelId, {
        status: "ACTIVE",
        externalIdentity: result.externalIdentity,
      });
      await this.publishStatus(channel.userId, channelId, channel.type, {
        status: "ACTIVE",
        externalIdentity: result.externalIdentity,
      });
    } catch (error) {
      this.connectors.delete(channelId);
      const message = (error as Error).message;
      await this.persistStatus(channelId, { status: "ERROR", error: message });
      await this.publishStatus(channel.userId, channelId, channel.type, {
        status: "ERROR",
        error: message,
      });
      throw error;
    }
  }

  async disconnectChannel(channelId: string): Promise<void> {
    const connector = this.connectors.get(channelId);
    if (connector) {
      await connector.disconnect().catch(() => undefined);
      this.connectors.delete(channelId);
    }
  }

  /**
   * Resolve a live connector for outbound delivery. If the process lost
   * the connection (e.g. after a transient crash) but the DB says the
   * channel should be active, reconnect lazily once.
   */
  async getOrReconnect(channelId: string): Promise<ChannelConnector> {
    const existing = this.connectors.get(channelId);
    if (existing?.isConnected()) return existing;

    await this.connectChannel(channelId);
    const connector = this.connectors.get(channelId);
    if (!connector) {
      throw new Error(`Channel ${channelId} could not be reconnected`);
    }
    return connector;
  }

  private createConnector(type: string): ChannelConnector {
    switch (type as CommunityChannelType) {
      case "TELEGRAM":
        return new TelegramConnector();
      case "WHATSAPP":
        return new WhatsAppConnector();
      default:
        throw new Error(`No connector implemented for channel type: ${type}`);
    }
  }

  /**
   * Dedup happens at enqueue time: BullMQ ignores a job whose jobId
   * already exists in the queue, so external retries of the same
   * channel-native message are dropped before any processing.
   */
  private async enqueueInbound(
    channelId: string,
    userId: string,
    channelType: CommunityChannelType,
    message: NormalizedInboundMessage,
  ): Promise<void> {
    const job: CommunityInboundJob = {
      channelId,
      userId,
      channelType,
      externalMessageId: message.externalMessageId,
      externalUserId: message.externalUserId,
      username: message.username,
      displayName: message.displayName,
      text: message.text,
      receivedAt: message.receivedAt,
    };

    await this.inboundQueue.add("process-message", job, {
      jobId: `${channelId}:${message.externalUserId}:${message.externalMessageId}`,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 86400 },
    });
  }

  private async handleStatusChange(
    channelId: string,
    userId: string,
    channelType: CommunityChannelType,
    update: { status: string; externalIdentity?: string; error?: string },
  ): Promise<void> {
    await this.persistStatus(channelId, update);
    await this.publishStatus(userId, channelId, channelType, update);

    if (update.status === "ERROR" || update.status === "REQUIRES_RESCAN") {
      this.connectors.delete(channelId);
    }
  }

  private async handleQrCode(
    channelId: string,
    userId: string,
    channelType: CommunityChannelType,
    qrDataUrl: string,
  ): Promise<void> {
    // Persist AWAITING_QR status
    await this.persistStatus(channelId, { status: "AWAITING_QR" });
    // Publish QR code event to frontend
    const event: CommunityChannelStatusEvent = {
      userId,
      channelId,
      channelType,
      status: "AWAITING_QR",
      qrDataUrl,
      timestamp: new Date(),
    };
    await this.events
      .publish(COMMUNITY_CHANNEL_STATUS_EVENT, event)
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not publish QR code event: ${(error as Error).message}`,
        );
      });
  }

  private async persistStatus(
    channelId: string,
    update: { status: string; externalIdentity?: string; error?: string },
  ): Promise<void> {
    await prisma.communityChannel
      .update({
        where: { id: channelId },
        data: {
          status: update.status as never,
          lastError: update.error ?? null,
          ...(update.externalIdentity
            ? { externalIdentity: update.externalIdentity }
            : {}),
          ...(update.status === "ACTIVE"
            ? { lastConnectedAt: new Date() }
            : {}),
        },
      })
      .catch((error) => {
        this.logger.warn(
          `Could not persist status for channel ${channelId}: ${(error as Error).message}`,
        );
      });
  }

  private async publishStatus(
    userId: string,
    channelId: string,
    channelType: CommunityChannelType,
    update: { status: string; externalIdentity?: string; error?: string },
  ): Promise<void> {
    const event: CommunityChannelStatusEvent = {
      userId,
      channelId,
      channelType,
      status: update.status as CommunityChannelStatusEvent["status"],
      externalIdentity: update.externalIdentity,
      error: update.error,
      timestamp: new Date(),
    };
    await this.events
      .publish(COMMUNITY_CHANNEL_STATUS_EVENT, event)
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not publish channel status event: ${(error as Error).message}`,
        );
      });
  }
}
