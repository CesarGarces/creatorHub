import { Injectable, Logger } from "@nestjs/common";
import type {
  STTCloseReason,
  STTSessionInfo,
  STTFinalResult,
  STTProviderName,
} from "@creator-hub/shared-types";
import { voiceCredits } from "@creator-hub/shared-types";
import { STTSessionManager } from "./stt-session.manager";
import { STTProviderRegistry } from "./providers/stt-provider.registry";

interface MinimalSocket {
  id: string;
  emit: (event: string, data?: unknown) => void;
}

@Injectable()
export class STTEngineService {
  private logger = new Logger("STTEngineService");

  constructor(
    private sessionManager: STTSessionManager,
    private providerRegistry: STTProviderRegistry,
  ) {}

  startSession(
    userId: string,
    client: MinimalSocket,
    provider?: STTProviderName,
    language?: string,
    requestId?: string,
    model?: string,
  ): STTSessionInfo {
    return this.sessionManager.createSession(
      userId,
      client,
      provider,
      language,
      requestId,
      model,
    );
  }

  /**
   * Ends the socket's session gracefully: the provider transcribes what it
   * still holds and the full transcript is returned (with the session's
   * `requestId`). The session is detached first, so a new one can start
   * meanwhile without being closed by this one.
   */
  async endSession(
    clientId: string,
  ): Promise<(STTFinalResult & { requestId?: string }) | null> {
    const session = this.sessionManager.takeSession(clientId);
    if (!session) return null;

    try {
      const result = await session.stream.end();
      return { ...result, requestId: session.requestId };
    } catch (error) {
      this.logger.error("Error ending STT session", {
        error: (error as Error).message,
      });
      return null;
    } finally {
      try {
        session.stream.close();
      } catch {
        /* ignore */
      }
      this.sessionManager.logClosed(session, "ended-by-client");
    }
  }

  async closeSession(clientId: string, reason?: STTCloseReason): Promise<void> {
    await this.sessionManager.closeSession(clientId, reason);
  }

  /**
   * Credits for a session: every started second × the price per second
   * (Admin → Voice), rounded up to whole credits. See `voiceCredits`.
   */
  calculateCredits(durationMs: number, creditsPerSecond: number): number {
    return voiceCredits(durationMs, creditsPerSecond);
  }

  hasActiveSession(clientId: string): boolean {
    return this.sessionManager.hasActiveSession(clientId);
  }

  writeAudioChunk(clientId: string, chunk: Buffer): boolean {
    const session = this.sessionManager.getSession(clientId);
    if (!session) return false;
    session.stream.writeAudioChunk(chunk);
    return true;
  }

  isAvailable(): boolean {
    return this.providerRegistry.getAvailableProvider() !== undefined;
  }
}
