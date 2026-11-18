import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  STTCloseReason,
  STTErrorCode,
  STTSessionInfo,
  STTProviderName,
} from "@creator-hub/shared-types";
import { MAX_STT_SESSION_MS } from "@creator-hub/shared-types";
import { STTProviderRegistry } from "./providers/stt-provider.registry";

interface MinimalSocket {
  id: string;
  emit: (event: string, data?: unknown) => void;
}

/**
 * One live speech-to-text session per socket. Every `stt:*` event it emits
 * carries the client's `requestId` (when given in `stt:start`), so the
 * client can ignore late events of an earlier session; every close is
 * logged with its reason.
 */
@Injectable()
export class STTSessionManager {
  private logger = new Logger("STTSessionManager");
  private activeSessions = new Map<string, STTSessionInfo>();

  constructor(private providerRegistry: STTProviderRegistry) {}

  createSession(
    userId: string,
    client: MinimalSocket,
    providerName?: STTProviderName,
    language?: string,
    requestId?: string,
    /** Deepgram model (Admin → Voice); the provider's default if omitted. */
    model?: string,
  ): STTSessionInfo {
    const existing = this.activeSessions.get(client.id);
    if (existing) {
      void this.closeSession(client.id, "replaced-by-new-session");
    }

    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : this.providerRegistry.getAvailableProvider();

    if (!provider) {
      throw new Error("No STT provider available");
    }

    const sessionId = randomUUID();
    const emit = (event: string, data: Record<string, unknown> = {}) =>
      client.emit(event, requestId ? { ...data, requestId } : data);
    /** Ends this session (if it is still the socket's current one). */
    const fail = (
      code: STTErrorCode,
      message: string,
      reason: STTCloseReason,
    ) => {
      if (this.activeSessions.get(client.id)?.sessionId !== sessionId) return;
      void this.closeSession(client.id, reason);
      emit("stt:error", { code, message });
    };

    const timeout = setTimeout(() => {
      this.logger.warn("STT session hard timeout", {
        sessionId,
        userId,
        clientId: client.id,
      });
      fail(
        "SESSION_TIMEOUT",
        "Recording limit reached (3 minutes max)",
        "time-limit",
      );
    }, MAX_STT_SESSION_MS);

    const stream = provider.createStream({
      language,
      model,
      interimResults: true,
      endpointing: 300,
      utteranceEndMs: 3000,

      onPartialTranscript: (text: string, isFinal: boolean) => {
        emit("stt:partial", { text, isFinal, timestamp: Date.now() });
      },

      onUtteranceEnd: () => {
        this.logger.debug("Utterance end detected", { sessionId, userId });
        emit("stt:utterance_end", { sessionId });
      },

      onError: (error: Error) => {
        this.logger.error("STT stream error", {
          sessionId,
          userId,
          error: error.message,
        });
        fail("STREAM_ERROR", error.message, "stream-error");
      },

      onUnexpectedClose: ({ code, reason }) => {
        this.logger.warn("STT provider closed the stream", {
          sessionId,
          userId,
          code,
          reason,
        });
        fail(
          "PROVIDER_CLOSED",
          "The voice connection was interrupted",
          "provider-closed",
        );
      },
    });

    const session: STTSessionInfo = {
      sessionId,
      requestId,
      userId,
      clientId: client.id,
      stream,
      startedAt: Date.now(),
      language: language || "en",
      timeout,
    };

    this.activeSessions.set(client.id, session);

    this.logger.log("STT session created", {
      sessionId,
      requestId,
      userId,
      provider: provider.name,
      model,
      language,
    });

    return session;
  }

  getSession(clientId: string): STTSessionInfo | undefined {
    return this.activeSessions.get(clientId);
  }

  async closeSession(
    clientId: string,
    reason: STTCloseReason = "ended-by-client",
  ): Promise<void> {
    const session = this.takeSession(clientId);
    if (!session) return;
    try {
      session.stream.close();
    } catch {
      /* ignore */
    }
    this.logClosed(session, reason);
  }

  /**
   * Detaches the socket's session (no more audio, events or timeout) and
   * returns it, so it can be finalized while a new session may start.
   */
  takeSession(clientId: string): STTSessionInfo | undefined {
    const session = this.activeSessions.get(clientId);
    if (!session) return undefined;
    clearTimeout(session.timeout);
    this.activeSessions.delete(clientId);
    return session;
  }

  logClosed(session: STTSessionInfo, reason: STTCloseReason): void {
    this.logger.log("STT session closed", {
      sessionId: session.sessionId,
      requestId: session.requestId,
      userId: session.userId,
      reason,
      durationMs: Date.now() - session.startedAt,
    });
  }

  hasActiveSession(clientId: string): boolean {
    return this.activeSessions.has(clientId);
  }
}
