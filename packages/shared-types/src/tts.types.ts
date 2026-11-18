/**
 * Text-to-speech (TTS) contract — `@creator-hub/tts-engine`.
 *
 * Mirrors the speech-to-text contract (`stt.types.ts`): providers behind an
 * interface, a registry and a factory. Unlike STT, the voice is not
 * configurable (not in Admin → AI Models, not in any settings panel): the
 * platform always speaks with **Deepgram Aura-2**, and the voice follows the
 * language of the reply (see `TTS_VOICES`).
 */

export type TTSProviderName = "deepgram" | "mock";

/** Languages the platform can speak (the Robotina assistant replies in them). */
export const TTS_LANGUAGES = ["en", "es", "pt"] as const;
export type TTSLanguage = (typeof TTS_LANGUAGES)[number];

export interface TTSVoice {
  /** Deepgram model id sent to `/v1/speak?model=…`. */
  model: string;
  /** Display name of the voice. */
  name: string;
  /** Accent shown in the UI ("American", "Colombian", "Brazilian"). */
  accent: string;
  gender: "feminine" | "masculine";
  language: TTSLanguage;
}

/** Deepgram TTS model family. Always Aura-2. */
export const TTS_MODEL_FAMILY = "aura-2";

/**
 * One Aura-2 voice per language:
 * - English → Andromeda (American, feminine)
 * - Spanish → Celeste (Colombian, feminine)
 * - Portuguese → Bianca (Brazilian, feminine)
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
    model: "aura-2-bianca-pt",
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

/** The Aura-2 voice for a language (English for anything unknown). */
export function ttsVoiceFor(language: unknown): TTSVoice {
  return TTS_VOICES[isTTSLanguage(language) ? language : "en"];
}

/** Deepgram `/v1/speak` accepts at most 2,000 characters per request. */
export const TTS_MAX_CHARS_PER_REQUEST = 2000;

/**
 * Credits per started minute of synthesized speech (1 credit per reply of up
 * to a minute, 2 for up to two minutes…). A platform constant on purpose:
 * TTS is not an admin-configurable model.
 */
export const TTS_CREDITS_PER_MINUTE = 1;

export interface TTSSynthesizeParams {
  text: string;
  language: TTSLanguage;
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
