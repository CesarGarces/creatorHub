import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import type { CommunityChannelType } from "@creator-hub/shared-types";
import type {
  ChannelConnector,
  ChannelConnectorEvents,
  ConnectResult,
  NormalizedInboundMessage,
} from "./channel-connector.interface";

export interface WhatsAppCredentials {
  /** Stored Baileys auth state (creds + signal keys). Undefined on first connect. */
  authState?: {
    creds: ReturnType<typeof initAuthCreds>;
    keys: Record<string, Record<string, unknown>>;
  };
}

/**
 * WhatsApp connector based on Baileys (WhatsApp Web multi-device protocol).
 *
 * First connection requires QR-code pairing (like WhatsApp Web).
 * Subsequent connections restore the session from stored credentials.
 */
export class WhatsAppConnector implements ChannelConnector {
  readonly type: CommunityChannelType = "WHATSAPP";

  private sock: WASocket | null = null;
  private _connected = false;
  private _events: ChannelConnectorEvents | null = null;
  private _onSessionUpdate:
    | ((state: WhatsAppCredentials) => Promise<void>)
    | null = null;
  private _qrGenerated = false;

  /**
   * Set a callback to persist session state updates. Called whenever
   * Baileys rotates keys or updates credentials.
   */
  setSessionUpdater(updater: (state: WhatsAppCredentials) => Promise<void>) {
    this._onSessionUpdate = updater;
  }

  async connect(
    credentials: unknown,
    events: ChannelConnectorEvents,
  ): Promise<ConnectResult> {
    this._events = events;
    this._qrGenerated = false;

    await this.disconnect();

    const creds = credentials as WhatsAppCredentials;

    // Build auth state: restore from stored or start fresh
    const authState = this.buildAuthState(creds);

    const sock = makeWASocket({
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: async (type: any, ids: string[]) => {
              const result: Record<string, any> = {};
              for (const id of ids) {
                result[id] = authState.keys[type]?.[id];
              }
              return result;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set: async (data: any) => {
              for (const type in data) {
                if (!authState.keys[type]) {
                  authState.keys[type] = {};
                }
                for (const id in data[type]) {
                  authState.keys[type][id] = data[type][id];
                }
              }
            },
          },
          undefined,
        ),
      },
      browser: ["CreatorHub", "Safari", "3.0"],
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      qrTimeout: 60_000,
    });

    this.sock = sock;

    // ─── Connection state handler ──────────────────────────────
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !this._qrGenerated) {
        this._qrGenerated = true;
        // Generate QR code image and emit
        void this.emitQrCode(qr);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          this._connected = false;
          void events.onStatusChange({
            status: "REQUIRES_RESCAN",
            error: "Session expired — scan QR again",
          });
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          this._connected = false;
          void events.onStatusChange({
            status: "ERROR",
            error: "Connection replaced by another session",
          });
        } else if (statusCode !== DisconnectReason.connectionClosed) {
          void events.onStatusChange({
            status: "DISCONNECTED",
            error: `Connection closed (${statusCode}), reconnecting…`,
          });
        }
      }

      if (connection === "open") {
        this._connected = true;
        const phone = sock.user?.id?.replace(/:.*@/, "@");
        void events.onStatusChange({
          status: "CONNECTED",
          externalIdentity: phone,
        });
      }
    });

    // ─── Credential update handler (key rotation) ──────────────
    sock.ev.on("creds.update", () => {
      void this.persistSession(authState);
    });

    // ─── Message handler ───────────────────────────────────────
    sock.ev.on("messages.upsert", (msg) => {
      if (msg.type !== "notify") return;

      for (const message of msg.messages) {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid) continue;
        if (remoteJid === "status@broadcast") continue;
        // Only handle 1:1 chats (ending with @s.whatsapp.net)
        if (!remoteJid.endsWith("@s.whatsapp.net")) continue;

        // Only process text messages
        const text =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text;
        if (!text || !text.trim()) continue;

        const msgId = message.key.id || `${Date.now()}`;
        const pushName = message.pushName || "";

        const normalized: NormalizedInboundMessage = {
          externalMessageId: msgId,
          externalUserId: remoteJid,
          username: remoteJid.replace(/@s\.whatsapp\.net$/, ""),
          displayName: pushName,
          text: text.trim(),
          receivedAt: message.messageTimestamp
            ? Number(message.messageTimestamp) * 1000
            : Date.now(),
        };

        void events.onMessage(normalized);
      }
    });

    // Always wait for either connection or QR code generation.
    // On first connect: Baileys will emit QR.
    // On reconnect with stored creds: Baileys will connect directly.
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 15000);
      const handler = (update: { connection?: string; qr?: string }) => {
        if (update.connection === "open" || update.qr) {
          clearTimeout(timeout);
          sock.ev.off("connection.update", handler);
          resolve();
        }
      };
      sock.ev.on("connection.update", handler);
    });

    return {
      externalIdentity: sock.user?.id?.replace(/:.*@/, "@"),
    };
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        // end() throws if the socket never connected — safe to ignore
      }
    }
    this.sock = null;
    this._connected = false;
    this._events = null;
  }

  async sendMessage(externalUserId: string, text: string): Promise<void> {
    if (!this.sock || !this._connected) {
      throw new Error("WhatsApp connector is not connected");
    }

    for (const chunk of splitMessage(text, 4096)) {
      await this.sock.sendMessage(externalUserId, { text: chunk });
    }
  }

  isConnected(): boolean {
    return this._connected;
  }

  // ─── Private helpers ─────────────────────────────────────────

  private buildAuthState(creds: WhatsAppCredentials) {
    if (creds?.authState) {
      return {
        creds: creds.authState.creds as ReturnType<typeof initAuthCreds>,
        keys: creds.authState.keys as Record<string, Record<string, unknown>>,
      };
    }

    return {
      creds: initAuthCreds(),
      keys: {} as Record<string, Record<string, unknown>>,
    };
  }

  private async persistSession(authState: {
    creds: ReturnType<typeof initAuthCreds>;
    keys: Record<string, Record<string, unknown>>;
  }): Promise<void> {
    if (!this._onSessionUpdate) return;

    try {
      await this._onSessionUpdate({
        authState: {
          creds: authState.creds,
          keys: authState.keys,
        },
      });
    } catch (error) {
      console.error(
        "Failed to persist WhatsApp session:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  private async emitQrCode(qr: string): Promise<void> {
    if (!this._events?.onQrCode) return;

    try {
      // Generate a PNG QR code as a base64 data URL
      const dataUrl = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });

      void this._events.onQrCode(dataUrl);
    } catch (error) {
      console.error(
        "Failed to generate QR code:",
        error instanceof Error ? error.message : error,
      );
    }
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
