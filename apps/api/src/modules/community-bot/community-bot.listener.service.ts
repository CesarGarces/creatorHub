import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  DOMAIN_EVENT_SUBSCRIBER,
  type DomainEventSubscriber,
} from "@creator-hub/domain-events";
import {
  COMMUNITY_CHANNEL_STATUS_EVENT,
  COMMUNITY_MESSAGE_RECEIVED_EVENT,
  COMMUNITY_REPLY_SENT_EVENT,
  COMMUNITY_REPLY_SKIPPED_EVENT,
  type CommunityChannelStatusEvent,
  type CommunityMessageReceivedEvent,
  type CommunityReplySentEvent,
  type CommunityReplySkippedEvent,
} from "@creator-hub/shared-types";
import { AppGateway } from "../websocket/websocket.gateway";

const SUBSCRIPTIONS: Array<{ channel: string; wsEvent: string }> = [
  {
    channel: COMMUNITY_CHANNEL_STATUS_EVENT,
    wsEvent: "community:channel_status",
  },
  {
    channel: COMMUNITY_MESSAGE_RECEIVED_EVENT,
    wsEvent: "community:message_received",
  },
  { channel: COMMUNITY_REPLY_SENT_EVENT, wsEvent: "community:reply_sent" },
  {
    channel: COMMUNITY_REPLY_SKIPPED_EVENT,
    wsEvent: "community:reply_skipped",
  },
];

/**
 * Bridges community-bot domain events (published by the worker over
 * Redis pub/sub) to the creator's browser via WebSocket — same pattern
 * as the payment listener.
 */
@Injectable()
export class CommunityBotListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(CommunityBotListenerService.name);

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private readonly eventSubscriber: DomainEventSubscriber,
    private readonly gateway: AppGateway,
  ) {}

  async onModuleInit() {
    await this.eventSubscriber.subscribe<CommunityChannelStatusEvent>(
      COMMUNITY_CHANNEL_STATUS_EVENT,
      (event) => this.forward(event.userId, "community:channel_status", event),
    );
    await this.eventSubscriber.subscribe<CommunityMessageReceivedEvent>(
      COMMUNITY_MESSAGE_RECEIVED_EVENT,
      (event) =>
        this.forward(event.userId, "community:message_received", event),
    );
    await this.eventSubscriber.subscribe<CommunityReplySentEvent>(
      COMMUNITY_REPLY_SENT_EVENT,
      (event) => this.forward(event.userId, "community:reply_sent", event),
    );
    await this.eventSubscriber.subscribe<CommunityReplySkippedEvent>(
      COMMUNITY_REPLY_SKIPPED_EVENT,
      (event) => this.forward(event.userId, "community:reply_skipped", event),
    );

    this.logger.log("Subscribed to community-bot events");
  }

  async onModuleDestroy() {
    for (const { channel } of SUBSCRIPTIONS) {
      await this.eventSubscriber.unsubscribe(channel);
    }
  }

  private forward(userId: string, wsEvent: string, payload: unknown) {
    this.logger.log(`Forwarding ${wsEvent} to user ${userId}`);
    this.gateway.emitToUser(userId, wsEvent, payload);
  }
}
