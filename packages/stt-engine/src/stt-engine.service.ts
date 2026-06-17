import { Injectable, Logger } from "@nestjs/common";
import type {
  STTSessionInfo,
  STTFinalResult,
  STTProviderName,
} from "@creator-hub/shared-types";
import { STT_CREDITS_PER_MINUTE } from "@creator-hub/shared-types";
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
  ): STTSessionInfo {
    return this.sessionManager.createSession(
      userId,
      client,
      provider,
      language,
    );
  }

  async endSession(clientId: string): Promise<STTFinalResult | null> {
    const session = this.sessionManager.getSession(clientId);
    if (!session) return null;

    try {
      const result = await session.stream.end();
      await this.sessionManager.closeSession(clientId);
      return result;
    } catch (error) {
      this.logger.error("Error ending STT session", {
        error: (error as Error).message,
      });
      await this.sessionManager.closeSession(clientId);
      return null;
    }
  }

  async closeSession(clientId: string): Promise<void> {
    await this.sessionManager.closeSession(clientId);
  }

  calculateCredits(durationMs: number): number {
    return Math.max(1, Math.ceil(durationMs / 60_000) * STT_CREDITS_PER_MINUTE);
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
