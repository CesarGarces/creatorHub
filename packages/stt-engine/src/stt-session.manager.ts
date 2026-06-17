import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import type {
  STTSessionInfo,
  STTProviderName,
} from "@creator-hub/shared-types";
import { MAX_STT_SESSION_MS } from "@creator-hub/shared-types";
import { STTProviderRegistry } from "./providers/stt-provider.registry";

interface MinimalSocket {
  id: string;
  emit: (event: string, data?: unknown) => void;
}

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
  ): STTSessionInfo {
    const existing = this.activeSessions.get(client.id);
    if (existing) {
      this.closeSession(client.id);
    }

    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : this.providerRegistry.getAvailableProvider();

    if (!provider) {
      throw new Error("No STT provider available");
    }

    const sessionId = randomUUID();

    const timeout = setTimeout(() => {
      this.logger.warn("STT session hard timeout", {
        sessionId,
        userId,
        clientId: client.id,
      });
      this.closeSession(client.id);
      client.emit("stt:error", {
        code: "SESSION_TIMEOUT",
        message: "Recording limit reached (3 minutes max)",
      });
    }, MAX_STT_SESSION_MS);

    const stream = provider.createStream({
      language,
      interimResults: true,
      endpointing: 300,
      utteranceEndMs: 3000,

      onPartialTranscript: (text: string, isFinal: boolean) => {
        client.emit("stt:partial", { text, isFinal, timestamp: Date.now() });
      },

      onUtteranceEnd: () => {
        this.logger.debug("Utterance end detected", {
          sessionId,
          userId,
        });
        client.emit("stt:utterance_end", { sessionId });
      },

      onError: (error: Error) => {
        this.logger.error("STT stream error", {
          sessionId,
          userId,
          error: error.message,
        });
        client.emit("stt:error", {
          code: "STREAM_ERROR",
          message: error.message,
        });
        this.closeSession(client.id);
      },
    });

    const session: STTSessionInfo = {
      sessionId,
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
      userId,
      provider: provider.name,
      language,
    });

    return session;
  }

  getSession(clientId: string): STTSessionInfo | undefined {
    return this.activeSessions.get(clientId);
  }

  async closeSession(clientId: string): Promise<void> {
    const session = this.activeSessions.get(clientId);
    if (!session) return;

    clearTimeout(session.timeout);

    try {
      session.stream.close();
    } catch {
      /* ignore */
    }

    this.activeSessions.delete(clientId);

    this.logger.log("STT session closed", {
      sessionId: session.sessionId,
      userId: session.userId,
    });
  }

  hasActiveSession(clientId: string): boolean {
    return this.activeSessions.has(clientId);
  }
}
