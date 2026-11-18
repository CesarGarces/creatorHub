import {
  TTS_LANGUAGES,
  ttsVoiceFor,
  type TTSAudio,
  type TTSProviderName,
  type TTSSynthesizeParams,
} from "@creator-hub/shared-types";
import { TTSProviderBase } from "./tts-provider.base";
import { estimateSpeechMs, silentWav } from "../audio-format";

/**
 * Development/test stand-in for Deepgram: silent WAV audio as long as the
 * text would take to say. Never registered in production.
 */
export class MockTTSProvider extends TTSProviderBase {
  readonly name: TTSProviderName = "mock";
  readonly supportedLanguages = TTS_LANGUAGES;

  protected getApiKeyEnvVar(): string | null {
    return null;
  }

  async synthesize(params: TTSSynthesizeParams): Promise<TTSAudio> {
    if (params.signal?.aborted) {
      const error = new Error("Speech synthesis aborted");
      error.name = "AbortError";
      throw error;
    }
    const durationMs = estimateSpeechMs(params.text);
    return {
      audio: silentWav(durationMs),
      mimeType: "audio/wav",
      durationMs,
      voice: ttsVoiceFor(params.language).model,
      provider: this.name,
    };
  }
}
