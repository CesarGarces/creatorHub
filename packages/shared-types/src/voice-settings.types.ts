/**
 * Voice settings — speech-to-text (STT) and text-to-speech (TTS) of the
 * platform, configured in Admin → Voice (STT & TTS) and stored in the
 * `VoiceSettings` row (`@creator-hub/voice-settings` reads it).
 *
 * Both run on Deepgram:
 * - STT: one streaming model (Nova-3 by default) for every voice button and
 *   Robotina's ears, priced in **credits per second** of recording;
 * - TTS: Aura-2 for English and Spanish and Flux for Portuguese (Aura-2 has
 *   no Portuguese voices), one voice ("actor") per language, priced in
 *   **credits per second** of speech.
 *
 * The catalogs below are what the admin can pick from; a Deepgram voice id
 * that is not listed (a newly released voice) can still be typed in.
 */
import {
  TTS_LANGUAGES,
  TTS_VOICES,
  type TTSLanguage,
  type TTSVoice,
} from "./tts.types";

// ── Speech-to-text ─────────────────────────────────────────────────────

export interface STTModelOption {
  /** Deepgram model id (`/v1/listen?model=…`). */
  id: string;
  name: string;
  /**
   * Understands several languages in one session (`language=multi`): the
   * user may speak English, Spanish or Portuguese. Other models transcribe
   * the user's interface language only.
   */
  multilingual: boolean;
}

export const STT_MODEL_OPTIONS: readonly STTModelOption[] = [
  { id: "nova-3", name: "Nova-3", multilingual: true },
  { id: "nova-2", name: "Nova-2", multilingual: false },
  { id: "enhanced", name: "Enhanced", multilingual: false },
  { id: "base", name: "Base", multilingual: false },
];

export const DEFAULT_STT_MODEL = "nova-3";

export function isSTTModel(value: unknown): boolean {
  return STT_MODEL_OPTIONS.some((m) => m.id === value);
}

/**
 * `language` for Deepgram's `/v1/listen`: `multi` for a multilingual model
 * (any of en/es/pt…), otherwise the session's language.
 */
export function sttListenLanguage(model: string, language?: string): string {
  const option = STT_MODEL_OPTIONS.find((m) => m.id === model);
  if (option?.multilingual ?? true) return "multi";
  return language || "en";
}

// ── Text-to-speech ─────────────────────────────────────────────────────

export interface TTSModelOption {
  /** Prefix of its voice ids: `aura-2` → `aura-2-celeste-es`. */
  id: string;
  name: string;
  languages: readonly TTSLanguage[];
}

export const TTS_MODEL_OPTIONS: readonly TTSModelOption[] = [
  { id: "aura-2", name: "Aura-2", languages: ["en", "es"] },
  // Portuguese has no Aura-2 voices: only Flux speaks it.
  { id: "flux", name: "Flux", languages: ["pt"] },
  { id: "aura", name: "Aura-1", languages: ["en"] },
];

export const DEFAULT_TTS_MODEL = "aura-2";

/** A voice ("actor") of the catalog. `model` is the full Deepgram voice id. */
export interface TTSVoiceOption extends TTSVoice {
  /** TTS model (family) it belongs to: `aura-2`, `flux` or `aura`. */
  family: string;
}

type Gender = TTSVoice["gender"];

const voice = (
  family: string,
  language: TTSLanguage,
  key: string,
  accent: string,
  gender: Gender,
): TTSVoiceOption => ({
  family,
  model: `${family}-${key}-${language}`,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  accent,
  gender,
  language,
});

const F: Gender = "feminine";
const M: Gender = "masculine";

/** Deepgram TTS voices by language (defaults first). */
export const TTS_VOICE_CATALOG: readonly TTSVoiceOption[] = [
  // Aura-2 — English
  voice("aura-2", "en", "andromeda", "American", F),
  voice("aura-2", "en", "amalthea", "Filipino", F),
  voice("aura-2", "en", "apollo", "American", M),
  voice("aura-2", "en", "arcas", "American", M),
  voice("aura-2", "en", "aries", "American", M),
  voice("aura-2", "en", "asteria", "American", F),
  voice("aura-2", "en", "athena", "American", F),
  voice("aura-2", "en", "atlas", "American", M),
  voice("aura-2", "en", "aurora", "American", F),
  voice("aura-2", "en", "callista", "American", F),
  voice("aura-2", "en", "cora", "American", F),
  voice("aura-2", "en", "cordelia", "American", F),
  voice("aura-2", "en", "delia", "American", F),
  voice("aura-2", "en", "draco", "British", M),
  voice("aura-2", "en", "electra", "American", F),
  voice("aura-2", "en", "harmonia", "American", F),
  voice("aura-2", "en", "helena", "American", F),
  voice("aura-2", "en", "hera", "American", F),
  voice("aura-2", "en", "hermes", "American", M),
  voice("aura-2", "en", "hyperion", "Australian", M),
  voice("aura-2", "en", "iris", "American", F),
  voice("aura-2", "en", "janus", "American", F),
  voice("aura-2", "en", "juno", "American", F),
  voice("aura-2", "en", "jupiter", "American", M),
  voice("aura-2", "en", "luna", "American", F),
  voice("aura-2", "en", "mars", "American", M),
  voice("aura-2", "en", "minerva", "American", F),
  voice("aura-2", "en", "neptune", "American", M),
  voice("aura-2", "en", "odysseus", "American", M),
  voice("aura-2", "en", "ophelia", "American", F),
  voice("aura-2", "en", "orion", "American", M),
  voice("aura-2", "en", "orpheus", "American", M),
  voice("aura-2", "en", "pandora", "British", F),
  voice("aura-2", "en", "phoebe", "American", F),
  voice("aura-2", "en", "pluto", "American", M),
  voice("aura-2", "en", "saturn", "American", M),
  voice("aura-2", "en", "selene", "American", F),
  voice("aura-2", "en", "thalia", "American", F),
  voice("aura-2", "en", "theia", "Australian", F),
  voice("aura-2", "en", "vesta", "American", F),
  voice("aura-2", "en", "zeus", "American", M),
  // Aura-2 — Spanish
  voice("aura-2", "es", "celeste", "Colombian", F),
  voice("aura-2", "es", "gloria", "Colombian", F),
  voice("aura-2", "es", "estrella", "Mexican", F),
  voice("aura-2", "es", "olivia", "Mexican", F),
  voice("aura-2", "es", "selena", "Latin American", F),
  voice("aura-2", "es", "antonia", "Argentine", F),
  voice("aura-2", "es", "carina", "Peninsular", F),
  voice("aura-2", "es", "diana", "Peninsular", F),
  voice("aura-2", "es", "agustina", "Peninsular", F),
  voice("aura-2", "es", "silvia", "Peninsular", F),
  voice("aura-2", "es", "sirio", "Mexican", M),
  voice("aura-2", "es", "javier", "Mexican", M),
  voice("aura-2", "es", "luciano", "Mexican", M),
  voice("aura-2", "es", "valerio", "Mexican", M),
  voice("aura-2", "es", "aquila", "Latin American", M),
  voice("aura-2", "es", "nestor", "Peninsular", M),
  voice("aura-2", "es", "alvaro", "Peninsular", M),
  // Flux — Portuguese (Aura-2 has no Portuguese voices)
  voice("flux", "pt", "bianca", "Brazilian", F),
  voice("flux", "pt", "bruno", "Brazilian", M),
  voice("flux", "pt", "claudia", "Brazilian", F),
  voice("flux", "pt", "leandro", "Brazilian", M),
  voice("flux", "pt", "marcia", "Brazilian", F),
  voice("flux", "pt", "mariana", "Brazilian", F),
  voice("flux", "pt", "marta", "Brazilian", F),
  voice("flux", "pt", "mateus", "Brazilian", M),
  voice("flux", "pt", "miguel", "Brazilian", M),
  voice("flux", "pt", "renato", "Brazilian", M),
  voice("flux", "pt", "roberto", "Brazilian", M),
  voice("flux", "pt", "rodrigo", "Brazilian", M),
  // Aura-1 — English only
  voice("aura", "en", "asteria", "American", F),
  voice("aura", "en", "luna", "American", F),
  voice("aura", "en", "stella", "American", F),
  voice("aura", "en", "athena", "British", F),
  voice("aura", "en", "hera", "American", F),
  voice("aura", "en", "orion", "American", M),
  voice("aura", "en", "arcas", "American", M),
  voice("aura", "en", "perseus", "American", M),
  voice("aura", "en", "angus", "Irish", M),
  voice("aura", "en", "orpheus", "American", M),
  voice("aura", "en", "helios", "British", M),
  voice("aura", "en", "zeus", "American", M),
];

/** Catalog voices of a model (family) and language. */
export function ttsVoicesFor(
  model: string,
  language: TTSLanguage,
): TTSVoiceOption[] {
  return TTS_VOICE_CATALOG.filter(
    (v) => v.family === model && v.language === language,
  );
}

const VOICE_KEY = "[a-z][a-z0-9]{1,30}";

/**
 * A Deepgram voice id for this model and language: `<model>-<name>-<lang>`
 * (e.g. `aura-2-celeste-es`). Catalog voices and newly released ones
 * typed by the admin both pass.
 */
export function isTTSVoiceId(
  model: string,
  voiceId: string,
  language: TTSLanguage,
): boolean {
  const option = TTS_MODEL_OPTIONS.find((m) => m.id === model);
  if (!option || !option.languages.includes(language)) return false;
  const pattern = new RegExp(`^${model}-${VOICE_KEY}-${language}$`);
  // "aura-2-x-en" must not pass as an Aura-1 voice named "2-x".
  return (
    pattern.test(voiceId) && (model !== "aura" || !/^aura-2-/.test(voiceId))
  );
}

/**
 * What to show for a voice id: the catalog entry, or one derived from the
 * id for a voice typed in by the admin.
 */
export function ttsVoiceInfo(
  voiceId: string,
  language: TTSLanguage,
): TTSVoiceOption {
  const known = TTS_VOICE_CATALOG.find((v) => v.model === voiceId);
  if (known) return known;
  const family =
    TTS_MODEL_OPTIONS.find((m) => voiceId.startsWith(`${m.id}-`))?.id ?? "aura";
  const key = voiceId.slice(family.length + 1).replace(/-[a-z]{2}$/, "");
  return {
    family,
    model: voiceId,
    name: key ? key.charAt(0).toUpperCase() + key.slice(1) : voiceId,
    accent: "",
    gender: "feminine",
    language,
  };
}

// ── Settings ───────────────────────────────────────────────────────────

export interface TTSLanguageVoice {
  /** TTS model (family): `aura-2`, `flux` or `aura`. */
  model: string;
  /** Deepgram voice id ("actor"), e.g. `aura-2-celeste-es`. */
  voice: string;
}

export interface VoiceSettings {
  stt: {
    provider: "deepgram";
    model: string;
    creditsPerSecond: number;
  };
  tts: {
    provider: "deepgram";
    creditsPerSecond: number;
    voices: Record<TTSLanguage, TTSLanguageVoice>;
  };
  /** Robotina's voice time for the Free plan (see `VoiceAllowance`). */
  freeTier: FreeTierLimit;
  /** ISO date of the last change (null: never saved, defaults). */
  updatedAt: string | null;
}

// ── Free plan limit ────────────────────────────────────────────────────

/** "monthly": the minutes come back on the 1st (UTC); "lifetime": once. */
export type FreeTierPeriod = "monthly" | "lifetime";
export const FREE_TIER_PERIODS: readonly FreeTierPeriod[] = [
  "monthly",
  "lifetime",
];
/** Most minutes the admin can give the Free plan. */
export const MAX_FREE_TIER_MINUTES = 10_000;

/**
 * Minutes of voice with Robotina the Free plan gets — the user's voice
 * (STT) plus hers (TTS). `minutes: null` = no limit (credits only). When
 * they are used up, Free users are invited to upgrade for unlimited use.
 */
export interface FreeTierLimit {
  minutes: number | null;
  period: FreeTierPeriod;
}

/** Error code (reply refused, `stt:error`) when the free minutes are gone. */
export const FREE_VOICE_LIMIT_CODE = "FREE_LIMIT_REACHED";
export const FREE_VOICE_LIMIT_MESSAGE =
  "You've used all your free minutes with Robotina. Upgrade your plan for unlimited use.";

/** A user's voice time with Robotina (`GET /voice/allowance`). */
export interface VoiceAllowance {
  /** Free plan with a limit set: the minutes below apply. */
  limited: boolean;
  period: FreeTierPeriod;
  limitSeconds: number | null;
  usedSeconds: number;
  /** null when unlimited. */
  remainingSeconds: number | null;
  exhausted: boolean;
  /** Monthly limit: when the minutes come back (ISO, 1st of next month UTC). */
  resetsAt: string | null;
}

/** Key of a usage row: the UTC month ("2026-11"), or "all" for lifetime. */
export function voiceUsagePeriodKey(
  period: FreeTierPeriod,
  now: Date = new Date(),
): string {
  if (period === "lifetime") return "all";
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

/** First instant of the next UTC month. */
export function nextMonthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** The allowance from the limit and the seconds used in its period. */
export function voiceAllowanceFrom(
  limit: FreeTierLimit,
  usedSeconds: number,
  isFreePlan: boolean,
  now: Date = new Date(),
): VoiceAllowance {
  const limited = isFreePlan && limit.minutes !== null;
  const limitSeconds = limited ? limit.minutes! * 60 : null;
  const remainingSeconds =
    limitSeconds === null ? null : Math.max(0, limitSeconds - usedSeconds);
  return {
    limited,
    period: limit.period,
    limitSeconds,
    usedSeconds,
    remainingSeconds,
    exhausted: remainingSeconds === 0,
    resetsAt:
      limited && limit.period === "monthly"
        ? nextMonthStart(now).toISOString()
        : null,
  };
}

/** Body of `PUT /admin/voice-settings`. */
export interface UpdateVoiceSettingsRequest {
  sttModel: string;
  sttCreditsPerSecond: number;
  ttsCreditsPerSecond: number;
  ttsVoices: Record<TTSLanguage, TTSLanguageVoice>;
  /** Free plan minutes with Robotina; null = no limit. */
  freeTierMinutes: number | null;
  freeTierPeriod: FreeTierPeriod;
}

/** Starting prices: 1 credit per second of listening, 2 per second spoken. */
export const DEFAULT_STT_CREDITS_PER_SECOND = 1;
export const DEFAULT_TTS_CREDITS_PER_SECOND = 2;
/** Highest price per second the admin can set. */
export const MAX_VOICE_CREDITS_PER_SECOND = 100;

export const DEFAULT_TTS_LANGUAGE_VOICES: Readonly<
  Record<TTSLanguage, TTSLanguageVoice>
> = Object.fromEntries(
  TTS_LANGUAGES.map((language) => {
    const voice = TTS_VOICES[language].model;
    const model =
      TTS_MODEL_OPTIONS.find(
        (option) =>
          option.languages.includes(language) &&
          voice.startsWith(`${option.id}-`),
      )?.id ?? DEFAULT_TTS_MODEL;
    return [language, { model, voice }];
  }),
) as Record<TTSLanguage, TTSLanguageVoice>;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stt: {
    provider: "deepgram",
    model: DEFAULT_STT_MODEL,
    creditsPerSecond: DEFAULT_STT_CREDITS_PER_SECOND,
  },
  tts: {
    provider: "deepgram",
    creditsPerSecond: DEFAULT_TTS_CREDITS_PER_SECOND,
    voices: { ...DEFAULT_TTS_LANGUAGE_VOICES },
  },
  // No limit until the admin sets one.
  freeTier: { minutes: null, period: "monthly" },
  updatedAt: null,
};

/** Whole minutes from 1 to MAX_FREE_TIER_MINUTES. */
export function isFreeTierMinutes(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_FREE_TIER_MINUTES
  );
}

/** A valid price per second: 0 (free) up to the maximum, cents at most. */
export function isVoiceCreditRate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_VOICE_CREDITS_PER_SECOND &&
    Math.abs(Math.round(value * 100) - value * 100) < 1e-6
  );
}

/**
 * Credits for `durationMs` of audio at `creditsPerSecond`: every started
 * second counts, and the total is rounded up to whole credits
 * (2.3 s at 1 cr/s → 3; 4.2 s at 2 cr/s → 10; 30 s at 0.02 cr/s → 1).
 * No audio or a free rate → 0.
 */
export function voiceCredits(
  durationMs: number,
  creditsPerSecond: number,
): number {
  if (!(durationMs > 0) || !(creditsPerSecond > 0)) return 0;
  const seconds = Math.ceil(durationMs / 1000);
  // Cents avoid float noise (3 × 0.1 = 0.30000000000000004 → 1, not 2).
  return Math.ceil((seconds * Math.round(creditsPerSecond * 100)) / 100);
}

/**
 * Longest audio a balance pays for at this rate, in whole seconds
 * (Infinity when free).
 */
export function voiceSecondsAffordable(
  balance: number,
  creditsPerSecond: number,
): number {
  if (!(creditsPerSecond > 0)) return Infinity;
  return Math.max(
    0,
    Math.floor((balance * 100) / Math.round(creditsPerSecond * 100)),
  );
}

/**
 * Public view of the settings (`GET /voice/pricing`): what the web shows
 * next to voice buttons and Robotina (prices, who speaks each language).
 */
export interface VoicePricing {
  stt: { model: string; creditsPerSecond: number };
  /** Free plan minutes with Robotina (null: no limit). */
  freeTier: FreeTierLimit | null;
  tts: {
    creditsPerSecond: number;
    voices: Record<
      TTSLanguage,
      Pick<TTSVoice, "model" | "name" | "accent" | "gender">
    >;
  };
}

export function voicePricingFrom(settings: VoiceSettings): VoicePricing {
  const voices = Object.fromEntries(
    TTS_LANGUAGES.map((language) => {
      const info = ttsVoiceInfo(settings.tts.voices[language].voice, language);
      return [
        language,
        {
          model: info.model,
          name: info.name,
          accent: info.accent,
          gender: info.gender,
        },
      ];
    }),
  ) as VoicePricing["tts"]["voices"];
  return {
    stt: {
      model: settings.stt.model,
      creditsPerSecond: settings.stt.creditsPerSecond,
    },
    freeTier: settings.freeTier.minutes === null ? null : settings.freeTier,
    tts: { creditsPerSecond: settings.tts.creditsPerSecond, voices },
  };
}

export type VoiceSettingsField =
  | "sttModel"
  | "sttCreditsPerSecond"
  | "ttsCreditsPerSecond"
  | `ttsVoices.${TTSLanguage}`
  | "freeTierMinutes"
  | "freeTierPeriod";

export type VoiceSettingsErrorCode =
  | "invalidModel"
  | "invalidRate"
  | "invalidVoice"
  | "invalidMinutes"
  | "invalidPeriod";

export interface VoiceSettingsError {
  field: VoiceSettingsField;
  code: VoiceSettingsErrorCode;
}

/**
 * What is wrong with a `PUT /admin/voice-settings` body (empty = valid).
 * Shared by the API (authoritative) and the admin form.
 */
export function voiceSettingsErrors(input: unknown): VoiceSettingsError[] {
  const body = (input ?? {}) as Partial<Record<string, unknown>>;
  const errors: VoiceSettingsError[] = [];
  if (!isSTTModel(body.sttModel)) {
    errors.push({ field: "sttModel", code: "invalidModel" });
  }
  if (!isVoiceCreditRate(body.sttCreditsPerSecond)) {
    errors.push({ field: "sttCreditsPerSecond", code: "invalidRate" });
  }
  if (!isVoiceCreditRate(body.ttsCreditsPerSecond)) {
    errors.push({ field: "ttsCreditsPerSecond", code: "invalidRate" });
  }
  const voices = (body.ttsVoices ?? {}) as Partial<
    Record<string, Partial<TTSLanguageVoice> | undefined>
  >;
  for (const language of TTS_LANGUAGES) {
    const entry = voices[language];
    const model = typeof entry?.model === "string" ? entry.model : "";
    const voiceId = typeof entry?.voice === "string" ? entry.voice : "";
    const option = TTS_MODEL_OPTIONS.find((m) => m.id === model);
    if (!option || !option.languages.includes(language)) {
      errors.push({ field: `ttsVoices.${language}`, code: "invalidModel" });
    } else if (!isTTSVoiceId(model, voiceId, language)) {
      errors.push({ field: `ttsVoices.${language}`, code: "invalidVoice" });
    }
  }
  if (
    body.freeTierMinutes !== null &&
    !isFreeTierMinutes(body.freeTierMinutes)
  ) {
    errors.push({ field: "freeTierMinutes", code: "invalidMinutes" });
  }
  if (!FREE_TIER_PERIODS.includes(body.freeTierPeriod as FreeTierPeriod)) {
    errors.push({ field: "freeTierPeriod", code: "invalidPeriod" });
  }
  return errors;
}
