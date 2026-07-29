// ============================================================
// COMMUNITY BOT — Contracts shared between the API, the
// community-worker process and the web frontend.
//
// Two transport mechanisms are used (same convention as the
// rest of the platform):
//   - BullMQ queues: durable jobs with retries (inbound messages,
//     outbound replies, channel lifecycle commands).
//   - domain-events (Redis pub/sub): fire-and-forget notifications
//     consumed by the API to push real-time updates over WebSocket.
// ============================================================

export type CommunityChannelType = "TELEGRAM" | "WHATSAPP" | "INSTAGRAM";

export type CommunityChannelStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "AWAITING_QR"
  | "ACTIVE"
  | "REQUIRES_RESCAN"
  | "ERROR";

export type CommunityMessageDirection = "INBOUND" | "OUTBOUND";

export type CommunityMessageStatus =
  | "RECEIVED"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "SKIPPED";

// ─── BullMQ queue names ──────────────────────────────────────

export const COMMUNITY_INBOUND_QUEUE = "community-inbound";
export const COMMUNITY_OUTBOUND_QUEUE = "community-outbound";
export const COMMUNITY_CHANNEL_COMMAND_QUEUE = "community-channel-commands";

// ─── domain-events channels (Redis pub/sub) ──────────────────

export const COMMUNITY_CHANNEL_STATUS_EVENT = "community.channel.status";
export const COMMUNITY_MESSAGE_RECEIVED_EVENT = "community.message.received";
export const COMMUNITY_REPLY_SENT_EVENT = "community.reply.sent";
export const COMMUNITY_REPLY_SKIPPED_EVENT = "community.reply.skipped";

// ─── Job payloads ────────────────────────────────────────────

/** A normalized message coming from any community channel. */
export interface CommunityInboundJob {
  /** CommunityChannel.id in our DB */
  channelId: string;
  /** Creator (platform user) that owns the channel */
  userId: string;
  channelType: CommunityChannelType;
  /** Channel-native message id, used for dedup */
  externalMessageId: string;
  /** Channel-native user id (telegram user id / whatsapp jid) */
  externalUserId: string;
  username?: string;
  displayName?: string;
  text: string;
  /** Epoch ms when the channel received the message */
  receivedAt: number;
}

/** A generated reply ready to be delivered through a connector. */
export interface CommunityOutboundJob {
  channelId: string;
  userId: string;
  channelType: CommunityChannelType;
  /** Target chat/user in the external channel */
  externalUserId: string;
  text: string;
  /** CommunityMessage.id (OUTBOUND row) to mark as SENT/FAILED */
  outboundMessageId: string;
}

export type CommunityChannelCommand =
  | {
      action: "CONNECT";
      channelId: string;
      userId: string;
      channelType: CommunityChannelType;
    }
  | {
      action: "DISCONNECT";
      channelId: string;
      userId: string;
      channelType: CommunityChannelType;
    }
  | {
      action: "REFRESH_STATUS";
      channelId: string;
      userId: string;
      channelType: CommunityChannelType;
    };

// ─── domain-events payloads ──────────────────────────────────

export interface CommunityChannelStatusEvent {
  userId: string;
  channelId: string;
  channelType: CommunityChannelType;
  status: CommunityChannelStatus;
  /** Present when status === "AWAITING_QR" (WhatsApp pairing) */
  qrDataUrl?: string;
  externalIdentity?: string;
  error?: string;
  timestamp: Date;
}

export interface CommunityMessageReceivedEvent {
  userId: string;
  channelId: string;
  conversationId: string;
  messageId: string;
  contactName?: string;
  preview: string;
  timestamp: Date;
}

export interface CommunityReplySentEvent {
  userId: string;
  channelId: string;
  conversationId: string;
  messageId: string;
  creditsUsed: number;
  modelId: string;
  timestamp: Date;
}

export interface CommunityReplySkippedEvent {
  userId: string;
  channelId: string;
  reason:
    | "cooldown"
    | "daily_limit"
    | "insufficient_credits"
    | "blocked_contact"
    | "bot_disabled";
  timestamp: Date;
}
