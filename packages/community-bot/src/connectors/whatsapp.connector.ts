import makeWASocket, {
  DisconnectReason,
  initAuthCreds,
  makeCacheableSignalKeyStore,
  WASocket,
  Browsers,
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
  authState?: {
    creds: ReturnType<typeof initAuthCreds>;
    keys: Record<string, Record<string, unknown>>;
  };
}

const baileysLogger = {
  trace: () => {},
  debug: () => {},
  info: (...args: unknown[]) => console.log("[Baileys]", ...args),
  warn: (...args: unknown[]) => console.warn("[Baileys] WARN", ...args),
  error: (...args: unknown[]) => console.error("[Baileys] ERROR", ...args),
  child: () => baileysLogger,
  level: "info",
};

type AuthState = {
  creds: ReturnType<typeof initAuthCreds>;
  keys: Record<string, Record<string, unknown>>;
};

/**
 * WhatsApp connector based on Baileys (WhatsApp Web multi-device protocol).
 *
 * First connection requires QR-code pairing (like WhatsApp Web).
 * Subsequent connections restore the session from stored credentials.
 *
 * After pairing, WhatsApp forces a stream restart (error 515).
 * The connector handles this by reconnecting with the saved credentials.
 */
export class WhatsAppConnector implements ChannelConnector {
  readonly type: CommunityChannelType = "WHATSAPP";

  private sock: WASocket | null = null;
  private _connected = false;
  private _events: ChannelConnectorEvents | null = null;
  private _onSessionUpdate:
    | ((state: WhatsAppCredentials) => Promise<void>)
    | null = null;
  private _destroyed = false;

  setSessionUpdater(updater: (state: WhatsAppCredentials) => Promise<void>) {
    this._onSessionUpdate = updater;
  }

  async connect(
    credentials: unknown,
    events: ChannelConnectorEvents,
  ): Promise<ConnectResult> {
    await this.disconnect();
    this._destroyed = false;
    this._events = events;

    const creds = credentials as WhatsAppCredentials;
    const authState = this.buildAuthState(creds);

    // ── Attempt 1: fresh socket (may need QR pairing) ──────────
    const sock = this.createSocket(authState);
    this.sock = sock;

    this.attachEventHandlers(sock, events, authState);

    const outcome = await this.awaitOutcome(sock, 90_000);

    if (outcome === "connected") {
      return { externalIdentity: sock.user!.id.replace(/:.*@/, "@") };
    }

    if (outcome === "paired") {
      // ── Attempt 2: reconnect after pairing (515 restart) ────
      console.log(
        "[WhatsAppConnector] Pairing succeeded, reconnecting with saved credentials…",
      );

      for (let attempt = 2; attempt <= 3; attempt++) {
        const sock2 = this.createSocket(authState);
        this.sock = sock2;
        this.attachEventHandlers(sock2, events, authState);

        const timeoutMs = attempt === 2 ? 60_000 : 30_000;
        console.log(
          `[WhatsAppConnector] Attempt ${attempt}: waiting for connection (timeout ${timeoutMs / 1000}s)…`,
        );
        const outcome2 = await this.awaitOutcome(sock2, timeoutMs);

        if (outcome2 === "connected") {
          return { externalIdentity: sock2.user!.id.replace(/:.*@/, "@") };
        }

        console.log(
          `[WhatsAppConnector] Attempt ${attempt} failed: ${outcome2}`,
        );
      }

      throw new Error("WhatsApp reconnection after pairing failed — try again");
    }

    throw new Error(outcome);
  }

  async disconnect(): Promise<void> {
    this._destroyed = true;
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {}
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

  // ─── Socket factory ───────────────────────────────────────────

  private createSocket(authState: AuthState): WASocket {
    return makeWASocket({
      auth: {
        creds: authState.creds,
        keys: makeCacheableSignalKeyStore(
          {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            get: async (type: any, ids: string[]) => {
              const result: Record<string, any> = {};
              for (const id of ids) {
                const val = authState.keys[type]?.[id];
                if (val !== undefined) result[id] = val;
              }
              return result;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            set: async (data: any) => {
              for (const type in data) {
                if (!authState.keys[type]) authState.keys[type] = {};
                for (const id in data[type]) {
                  const value = data[type][id];
                  if (value === undefined || value === null) {
                    delete authState.keys[type][id];
                  } else {
                    authState.keys[type][id] = value;
                  }
                }
              }
            },
          },
          baileysLogger as never,
        ),
      },
      browser: Browsers.ubuntu("Chrome"),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      qrTimeout: 60_000,
      logger: baileysLogger as never,
    });
  }

  // ─── Attach Baileys event listeners ──────────────────────────

  private attachEventHandlers(
    sock: WASocket,
    events: ChannelConnectorEvents,
    authState: AuthState,
  ): void {
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (update.qr) {
        void this.emitQrCode(update.qr);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        // Error 515 = stream restart after pairing — expected, handled
        // by the reconnect logic in connect(), so we skip it here.
        if (statusCode === 515) {
          console.log(
            "[WhatsAppConnector] 515 stream restart on active socket, ignoring",
          );
          return;
        }

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
        } else {
          const reasonText =
            statusCode !== undefined ? String(statusCode) : "unknown reason";
          this._connected = false;
          void events.onStatusChange({
            status: "DISCONNECTED",
            error: `Connection closed (${reasonText}), reconnecting…`,
          });
        }
      }

      if (connection === "open" && sock.user?.id) {
        this._connected = true;
        const phone = sock.user.id.replace(/:.*@/, "@");
        void events.onStatusChange({
          status: "CONNECTED",
          externalIdentity: phone,
        });
      }
    });

    sock.ev.on("creds.update", () => {
      void this.persistSession(authState);
    });

    sock.ev.on("messages.upsert", (msg) => {
      console.log(
        "[WhatsAppConnector] messages.upsert type=%s count=%d",
        msg.type,
        msg.messages.length,
      );
      if (msg.type !== "notify") return;
      const myJid = sock.user?.id?.replace(/:.*@/, "@");
      for (const message of msg.messages) {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid) continue;
        if (remoteJid === "status@broadcast") continue;
        if (message.key.fromMe) continue;
        if (myJid && remoteJid === myJid) continue;

        const isWhatsApp =
          remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");
        if (!isWhatsApp) {
          console.log(
            "[WhatsAppConnector] Skipping non-WhatsApp JID: %s",
            remoteJid,
          );
          continue;
        }

        const text =
          message.message?.conversation ||
          message.message?.extendedTextMessage?.text;
        if (!text || !text.trim()) {
          console.log(
            "[WhatsAppConnector] Ignoring non-text message from %s",
            remoteJid,
          );
          continue;
        }

        const normalized: NormalizedInboundMessage = {
          externalMessageId: message.key.id || `${Date.now()}`,
          externalUserId: remoteJid,
          username: remoteJid.replace(/@(s\.whatsapp\.net|lid)$/, ""),
          displayName: message.pushName || "",
          text: text.trim(),
          receivedAt: message.messageTimestamp
            ? Number(message.messageTimestamp) * 1000
            : Date.now(),
        };
        console.log(
          "[WhatsAppConnector] Emitting message from %s: %s",
          remoteJid,
          text.trim().slice(0, 60),
        );
        void events.onMessage(normalized);
      }
    });
  }

  // ─── Wait for outcome: "connected" | "paired" | error msg ────

  private awaitOutcome(
    sock: WASocket,
    timeoutMs: number,
  ): Promise<"connected" | "paired" | string> {
    return new Promise<"connected" | "paired" | string>((resolve) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve("WhatsApp connection timed out — QR was not scanned in time");
        }
      }, timeoutMs);

      const handler = (update: {
        connection?: string;
        qr?: string;
        isNewLogin?: boolean;
        lastDisconnect?: { error?: Error };
      }) => {
        if (settled) return;

        if (update.isNewLogin) {
          // Pairing succeeded — credentials saved via creds.update.
          settled = true;
          clearTimeout(timeout);
          sock.ev.off("connection.update", handler);
          resolve("paired");
          return;
        }

        if (update.connection === "open" && sock.user?.id) {
          settled = true;
          clearTimeout(timeout);
          sock.ev.off("connection.update", handler);
          resolve("connected");
          return;
        }

        if (update.connection === "close") {
          const statusCode = (update.lastDisconnect?.error as Boom)?.output
            ?.statusCode;

          if (statusCode === 515) {
            // 515 after pairing is expected — will be handled by caller
            console.log(
              "[WhatsAppConnector] awaitOutcome: 515 received, waiting for auto-reconnect…",
            );
            return;
          }

          settled = true;
          clearTimeout(timeout);
          sock.ev.off("connection.update", handler);
          const reason =
            update.lastDisconnect?.error?.message || "unknown reason";
          resolve(`Connection closed: ${reason}`);
        }
      };

      sock.ev.on("connection.update", handler);
    });
  }

  // ─── Private helpers ─────────────────────────────────────────

  private buildAuthState(creds: WhatsAppCredentials): AuthState {
    if (creds?.authState) {
      const sanitizedKeys = this.sanitizeKeys(creds.authState.keys);
      return {
        creds: creds.authState.creds as ReturnType<typeof initAuthCreds>,
        keys: sanitizedKeys,
      };
    }
    return {
      creds: initAuthCreds(),
      keys: {} as Record<string, Record<string, unknown>>,
    };
  }

  private sanitizeKeys(
    keys: Record<string, Record<string, unknown>>,
  ): Record<string, Record<string, unknown>> {
    const clean: Record<string, Record<string, unknown>> = {};
    for (const type in keys) {
      if (!keys[type] || typeof keys[type] !== "object") continue;
      clean[type] = {};
      for (const id in keys[type]) {
        const val = keys[type][id];
        if (val === undefined || val === null) continue;
        if (typeof val === "number" && Number.isNaN(val)) {
          console.warn(
            `[WhatsAppConnector] Removing NaN key: type=${type} id=${id}`,
          );
          continue;
        }
        clean[type][id] = val;
      }
    }
    return clean;
  }

  private async persistSession(authState: AuthState): Promise<void> {
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
      const dataUrl = await QRCode.toDataURL(qr, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
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
