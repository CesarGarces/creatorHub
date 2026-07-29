import { Telegraf } from "telegraf";
import type { CommunityChannelType } from "@creator-hub/shared-types";
import type {
  ChannelConnector,
  ChannelConnectorEvents,
  ConnectResult,
  NormalizedInboundMessage,
} from "./channel-connector.interface";

export interface TelegramCredentials {
  botToken: string;
}

/**
 * Telegram connector based on Telegraf long polling.
 *
 * Long polling is used instead of webhooks so the worker does not need a
 * public URL (free, works locally and behind NAT). Replies are restricted
 * to private chats in v1: group spam would drain the creator's credits.
 */
export class TelegramConnector implements ChannelConnector {
  readonly type: CommunityChannelType = "TELEGRAM";

  private bot: Telegraf | null = null;
  private botId: number | null = null;
  private connected = false;

  async connect(
    credentials: unknown,
    events: ChannelConnectorEvents,
  ): Promise<ConnectResult> {
    const { botToken } = credentials as TelegramCredentials;
    if (!botToken || typeof botToken !== "string") {
      throw new Error("Telegram credentials must include a botToken");
    }

    await this.disconnect();

    const bot = new Telegraf(botToken);
    this.bot = bot;

    bot.catch((error) => {
      this.connected = false;
      void events.onStatusChange({
        status: "ERROR",
        error: error instanceof Error ? error.message : String(error),
      });
    });

    bot.on("message", (ctx) => {
      const message = ctx.message;
      const from = ctx.from;
      if (!from || from.is_bot) return;

      // v1: private chats only (cost + abuse control)
      if (ctx.chat?.type !== "private") return;

      const text = "text" in message ? message.text : undefined;
      if (!text || !text.trim()) return;

      const normalized: NormalizedInboundMessage = {
        externalMessageId: String(message.message_id),
        externalUserId: String(ctx.chat.id),
        username: from.username,
        displayName: [from.first_name, from.last_name]
          .filter(Boolean)
          .join(" "),
        text: text.trim(),
        receivedAt: message.date * 1000,
      };

      void events.onMessage(normalized);
    });

    // Validate the token and resolve the bot identity before launching:
    // getMe() throws on invalid tokens, surfacing config errors early.
    const me = await bot.telegram.getMe();
    this.botId = me.id;

    // launch() resolves only when the bot stops — do not await it.
    void bot.launch(() => {
      this.connected = false;
    });

    this.connected = true;

    const externalIdentity = me.username ? `@${me.username}` : undefined;
    void events.onStatusChange({ status: "CONNECTED", externalIdentity });

    return { externalIdentity };
  }

  async disconnect(): Promise<void> {
    if (this.bot) {
      try {
        this.bot.stop();
      } catch {
        // stop() throws if the bot never launched — safe to ignore
      }
    }
    this.bot = null;
    this.botId = null;
    this.connected = false;
  }

  async sendMessage(externalUserId: string, text: string): Promise<void> {
    if (!this.bot || !this.connected) {
      throw new Error("Telegram connector is not connected");
    }
    // Telegram message limit is 4096 chars; split defensively.
    for (const chunk of splitMessage(text, 4096)) {
      await this.bot.telegram.sendMessage(externalUserId, chunk);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.slice(i, i + maxLength));
  }
  return chunks;
}
