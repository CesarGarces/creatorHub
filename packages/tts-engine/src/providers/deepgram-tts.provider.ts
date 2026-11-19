import { Logger } from "@creator-hub/shared-utils";
import {
  TTS_LANGUAGES,
  TTS_MAX_CHARS_PER_REQUEST,
  ttsVoiceFor,
  type TTSAudio,
  type TTSProviderName,
  type TTSSynthesizeParams,
} from "@creator-hub/shared-types";
import { TTSProviderBase } from "./tts-provider.base";
import { mp3DurationMs } from "../audio-format";

export const DEEPGRAM_SPEAK_URL = "https://api.deepgram.com/v1/speak";
export const DEEPGRAM_FLUX_SPEAK_URL = "https://api.deepgram.com/v2/speak";
/** MP3 at 48 kbps: small enough to stream as base64, clear for speech. */
const MP3_BIT_RATE = 48_000;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 400;

type FetchLike = typeof fetch;

export class DeepgramTTSError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DeepgramTTSError";
  }
}

/**
 * Deepgram text-to-speech: Aura on `POST /v1/speak`, Flux on `POST /v2/speak`.
 *
 * Speaks with `params.voice` — the voice set for the language in Admin →
 * Voice — or the language's default (Andromeda, Celeste on Aura-2; Bianca on
 * Flux, see `TTS_VOICES`). One request per chunk
 * of text (≤ 2,000 characters); the caller sends sentences as the model
 * writes them, so the first words are heard while the rest is generated.
 * Uses the same `DEEPGRAM_API_KEY` as speech-to-text.
 */
export class DeepgramTTSProvider extends TTSProviderBase {
  private logger = new Logger("DeepgramTTSProvider");
  readonly name: TTSProviderName = "deepgram";
  readonly supportedLanguages = TTS_LANGUAGES;

  constructor(private readonly fetchImpl: FetchLike = fetch) {
    super();
  }

  protected getApiKeyEnvVar(): string | null {
    return "DEEPGRAM_API_KEY";
  }

  /** Speak URL for a voice model: Flux on v2, Aura on v1 (exported for tests). */
  static speakUrl(model: string): string {
    const url = new URL(
      model.startsWith("flux-") ? DEEPGRAM_FLUX_SPEAK_URL : DEEPGRAM_SPEAK_URL,
    );
    url.searchParams.set("model", model);
    url.searchParams.set("encoding", "mp3");
    url.searchParams.set("bit_rate", String(MP3_BIT_RATE));
    return url.toString();
  }

  async synthesize(params: TTSSynthesizeParams): Promise<TTSAudio> {
    const text = params.text.trim();
    if (!text) throw new DeepgramTTSError("Nothing to say");
    if (text.length > TTS_MAX_CHARS_PER_REQUEST) {
      throw new DeepgramTTSError(
        `Text exceeds ${TTS_MAX_CHARS_PER_REQUEST} characters`,
      );
    }

    // The admin's voice for the language (Admin → Voice), else the default.
    const voice = { model: params.voice || ttsVoiceFor(params.language).model };
    const apiKey = this.getApiKey();

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (params.signal?.aborted) throw abortError();
      try {
        const audio = await this.request(
          voice.model,
          text,
          apiKey,
          params.signal,
        );
        return {
          audio,
          mimeType: "audio/mpeg",
          durationMs: mp3DurationMs(audio, MP3_BIT_RATE),
          voice: voice.model,
          provider: this.name,
        };
      } catch (error) {
        lastError = error;
        if (params.signal?.aborted || !isRetryable(error)) break;
        this.logger.warn("Deepgram TTS request failed, retrying", {
          voice: voice.model,
          error: (error as Error).message,
        });
        await delay(RETRY_DELAY_MS, params.signal);
      }
    }
    if (params.signal?.aborted) throw abortError();
    throw lastError;
  }

  private async request(
    model: string,
    text: string,
    apiKey: string,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await this.fetchImpl(DeepgramTTSProvider.speakUrl(model), {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });

    if (!response.ok) {
      let detail = "";
      try {
        const body = (await response.json()) as {
          err_msg?: string;
          message?: string;
        };
        detail = body.err_msg || body.message || "";
      } catch {
        // non-JSON error body
      }
      throw new DeepgramTTSError(
        `Deepgram TTS error ${response.status}${detail ? `: ${detail}` : ""}`,
        response.status,
      );
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length === 0) {
      throw new DeepgramTTSError("Deepgram TTS returned no audio");
    }
    return audio;
  }
}

/** Network errors, timeouts, 429 and 5xx are worth one more try. */
function isRetryable(error: unknown): boolean {
  if (error instanceof DeepgramTTSError) {
    return (
      error.status === undefined || error.status === 429 || error.status >= 500
    );
  }
  return true;
}

function abortError(): Error {
  const error = new Error("Speech synthesis aborted");
  error.name = "AbortError";
  return error;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
