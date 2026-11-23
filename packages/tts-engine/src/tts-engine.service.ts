import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import {
  ttsVoiceFor,
  voiceCredits,
  type TTSAudio,
  type TTSProviderName,
  type TTSSynthesizeParams,
  type TTSVoice,
} from "@creator-hub/shared-types";
import { TTSProviderRegistry } from "./providers/tts-provider.registry";

/**
 * Text-to-speech for the platform (the Robotina voice assistant today).
 *
 * Deepgram: Aura-2 for English/Spanish, Flux for Portuguese. Callers pass
 * the voice set for the language in Admin → Voice
 * (`@creator-hub/voice-settings`); without one the language's
 * default speaks (`TTS_VOICES`). Tools call `synthesize()` per chunk of
 * text and add up `durationMs` to bill with `calculateCredits()`.
 */
@Injectable()
export class TTSEngineService {
  private logger = new Logger("TTSEngineService");

  constructor(private providerRegistry: TTSProviderRegistry) {}

  /** Whether speech can be produced (Deepgram configured, or the dev mock). */
  isAvailable(): boolean {
    return this.providerRegistry.getAvailableProvider() !== undefined;
  }

  /** Name of the provider that would speak, if any. */
  activeProvider(): TTSProviderName | null {
    return this.providerRegistry.getAvailableProvider()?.name ?? null;
  }

  /** The language's default voice (without Admin → Voice settings). */
  voiceFor(language: unknown): TTSVoice {
    return ttsVoiceFor(language);
  }

  async synthesize(params: TTSSynthesizeParams): Promise<TTSAudio> {
    const provider = this.providerRegistry.getAvailableProvider();
    if (!provider) {
      throw new Error("No TTS provider available");
    }
    const started = Date.now();
    const audio = await provider.synthesize(params);
    this.logger.debug("Speech synthesized", {
      provider: provider.name,
      voice: audio.voice,
      chars: params.text.length,
      durationMs: audio.durationMs,
      latencyMs: Date.now() - started,
    });
    return audio;
  }

  /**
   * Credits for `durationMs` of speech at the price per minute (Admin →
   * Voice): every started second, rounded up to whole credits. No speech,
   * no charge.
   */
  calculateCredits(durationMs: number, creditsPerMinute: number): number {
    return voiceCredits(durationMs, creditsPerMinute);
  }
}
