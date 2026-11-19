/**
 * Text-to-speech (TTS) contract — `@creator-hub/tts-engine`.
 *
 * Mirrors the speech-to-text contract (`stt.types.ts`): providers behind an
 * interface, a registry and a factory. The platform speaks with **Deepgram**:
 * Aura-2 for English and Spanish, Flux for Portuguese (Aura-2 has no
 * Portuguese voices). The voice ("actor") of each language and the price per
 * second are set in Admin → Voice (STT & TTS) — see
 * `voice-settings.types.ts`. `TTS_VOICES` are the defaults (and the fallback
 * when nothing is saved).
 */

export type TTSProviderName = "deepgram" | "mock";

/** Languages the platform can speak (the Robotina assistant replies in them). */
export const TTS_LANGUAGES = ["en", "es", "pt"] as const;
export type TTSLanguage = (typeof TTS_LANGUAGES)[number];

export interface TTSVoice {
  /**
   * Deepgram model id sent to `/v1/speak?model=…` (Aura) or
   * `/v2/speak?model=…` (Flux, `flux-*`).
   */
  model: string;
  /** Display name of the voice. */
  name: string;
  /** Accent shown in the UI ("American", "Colombian", "Brazilian"). */
  accent: string;
  gender: "feminine" | "masculine";
  language: TTSLanguage;
}

/**
 * Default voice per language (Admin → Voice can change them):
 * - English → Andromeda (Aura-2, American, feminine)
 * - Spanish → Celeste (Aura-2, Colombian, feminine)
 * - Portuguese → Bianca (Flux, Brazilian, feminine)
 */
export const TTS_VOICES: Readonly<Record<TTSLanguage, TTSVoice>> = {
  en: {
    model: "aura-2-andromeda-en",
    name: "Andromeda",
    accent: "American",
    gender: "feminine",
    language: "en",
  },
  es: {
    model: "aura-2-celeste-es",
    name: "Celeste",
    accent: "Colombian",
    gender: "feminine",
    language: "es",
  },
  pt: {
    model: "flux-bianca-pt",
    name: "Bianca",
    accent: "Brazilian",
    gender: "feminine",
    language: "pt",
  },
};

export function isTTSLanguage(value: unknown): value is TTSLanguage {
  return (
    typeof value === "string" &&
    (TTS_LANGUAGES as readonly string[]).includes(value)
  );
}

/** The default voice for a language (English for anything unknown). */
export function ttsVoiceFor(language: unknown): TTSVoice {
  return TTS_VOICES[isTTSLanguage(language) ? language : "en"];
}

/** Deepgram TTS accepts at most 2,000 characters per request. */
export const TTS_MAX_CHARS_PER_REQUEST = 2000;

export interface TTSSynthesizeParams {
  text: string;
  language: TTSLanguage;
  /**
   * Deepgram voice id to speak with (Admin → Voice); the language's default
   * voice (`TTS_VOICES`) when omitted.
   */
  voice?: string;
  /** Aborts the request (client gone, reply interrupted). */
  signal?: AbortSignal;
}

export interface TTSAudio {
  /** Encoded audio (MP3 from Deepgram, WAV from the mock provider). */
  audio: Buffer;
  mimeType: string;
  /** Length of the speech, in milliseconds. */
  durationMs: number;
  /** The voice that spoke (Deepgram model id). */
  voice: string;
  provider: TTSProviderName;
}

export interface TTSProviderInterface {
  readonly name: TTSProviderName;
  readonly supportedLanguages: readonly TTSLanguage[];

  synthesize(params: TTSSynthesizeParams): Promise<TTSAudio>;
  validateConfig(): boolean;
}
