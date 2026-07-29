import type { CommunityChannelType } from "@creator-hub/shared-types";

/**
 * A channel-agnostic inbound message, normalized by the connector that
 * received it. Everything downstream (queues, processors, persistence)
 * works exclusively with this shape.
 */
export interface NormalizedInboundMessage {
  /** Channel-native message id (dedup key) */
  externalMessageId: string;
  /** Channel-native user/chat id to reply to */
  externalUserId: string;
  username?: string;
  displayName?: string;
  text: string;
  /** Epoch ms */
  receivedAt: number;
}

export interface ConnectorStatusUpdate {
  status: "CONNECTED" | "DISCONNECTED" | "REQUIRES_RESCAN" | "ERROR";
  /** e.g. @bot_username / phone number */
  externalIdentity?: string;
  error?: string;
}

export interface ChannelConnectorEvents {
  onMessage(message: NormalizedInboundMessage): void | Promise<void>;
  onStatusChange(update: ConnectorStatusUpdate): void | Promise<void>;
  /** WhatsApp pairing flow: QR image as data URL for the UI */
  onQrCode?(qrDataUrl: string): void | Promise<void>;
}

export interface ConnectResult {
  externalIdentity?: string;
}

/**
 * Contract every community channel connector must satisfy (Open/Closed:
 * adding WhatsApp/Instagram does not touch existing connectors or the
 * pipeline that consumes them).
 *
 * Implementations are stateful and live inside the community-worker
 * process, never in the stateless API.
 */
export interface ChannelConnector {
  readonly type: CommunityChannelType;

  /**
   * Establish the channel connection (long polling / websocket).
   * Must resolve once the channel is ready to receive messages and
   * report later lifecycle changes through `events.onStatusChange`.
   */
  connect(
    credentials: unknown,
    events: ChannelConnectorEvents,
  ): Promise<ConnectResult>;

  /** Tear down the connection. Must be idempotent. */
  disconnect(): Promise<void>;

  /** Deliver a text reply to a user/chat in the channel. */
  sendMessage(externalUserId: string, text: string): Promise<void>;

  isConnected(): boolean;
}
