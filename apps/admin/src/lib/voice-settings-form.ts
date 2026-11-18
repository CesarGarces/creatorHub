/**
 * Admin → Voice (STT & TTS) form: state, validation and the request body
 * for PUT /admin/voice-settings. Free of React so it can be unit tested;
 * the rules are the API's (`voiceSettingsErrors` in shared-types).
 */
import {
  DEFAULT_VOICE_SETTINGS,
  FREE_TIER_PERIODS,
  MAX_FREE_TIER_MINUTES,
  MAX_VOICE_CREDITS_PER_SECOND,
  STT_MODEL_OPTIONS,
  TTS_LANGUAGES,
  TTS_MODEL_OPTIONS,
  isVoiceCreditRate,
  ttsVoicesFor,
  voiceCredits,
  voiceSettingsErrors,
  type FreeTierPeriod,
  type TTSLanguage,
  type TTSLanguageVoice,
  type TTSModelOption,
  type TTSVoiceOption,
  type UpdateVoiceSettingsRequest,
  type VoiceSettings,
  type VoiceSettingsErrorCode,
  type VoiceSettingsField,
} from "@creator-hub/shared-types";

export {
  FREE_TIER_PERIODS,
  MAX_FREE_TIER_MINUTES,
  MAX_VOICE_CREDITS_PER_SECOND,
  STT_MODEL_OPTIONS,
  TTS_LANGUAGES,
  TTS_MODEL_OPTIONS,
};
export type { FreeTierPeriod, TTSLanguage, TTSVoiceOption, VoiceSettings };

/** "Other voice…": a Deepgram voice id typed by hand. */
export const CUSTOM_VOICE = "__custom__";

export interface VoiceLanguageForm {
  model: string;
  /** A catalog voice id, or CUSTOM_VOICE. */
  voice: string;
  /** The typed voice id when `voice` is CUSTOM_VOICE. */
  customVoice: string;
}

export interface VoiceSettingsForm {
  sttModel: string;
  /** Prices are kept as typed; validated on save. */
  sttCreditsPerSecond: string;
  ttsCreditsPerSecond: string;
  voices: Record<TTSLanguage, VoiceLanguageForm>;
  /** Free plan: limit Robotina to some minutes. */
  freeTierEnabled: boolean;
  /** Kept as typed (whole minutes); validated on save. */
  freeTierMinutes: string;
  freeTierPeriod: FreeTierPeriod;
}

/** Suggested minutes when the limit is switched on. */
export const DEFAULT_FREE_TIER_MINUTES = 10;

export type VoiceFormErrors = Partial<
  Record<VoiceSettingsField, VoiceSettingsErrorCode>
>;

function languageForm(
  language: TTSLanguage,
  value: TTSLanguageVoice,
): VoiceLanguageForm {
  const inCatalog = ttsVoicesFor(value.model, language).some(
    (v) => v.model === value.voice,
  );
  return inCatalog
    ? { model: value.model, voice: value.voice, customVoice: "" }
    : { model: value.model, voice: CUSTOM_VOICE, customVoice: value.voice };
}

export function formFromSettings(settings: VoiceSettings): VoiceSettingsForm {
  return {
    sttModel: settings.stt.model,
    sttCreditsPerSecond: String(settings.stt.creditsPerSecond),
    ttsCreditsPerSecond: String(settings.tts.creditsPerSecond),
    voices: Object.fromEntries(
      TTS_LANGUAGES.map((language) => [
        language,
        languageForm(language, settings.tts.voices[language]),
      ]),
    ) as Record<TTSLanguage, VoiceLanguageForm>,
    freeTierEnabled: settings.freeTier.minutes !== null,
    freeTierMinutes: String(
      settings.freeTier.minutes ?? DEFAULT_FREE_TIER_MINUTES,
    ),
    freeTierPeriod: settings.freeTier.period,
  };
}

/** The platform defaults (Nova-3, 1 cr/s; Andromeda, Celeste, Bianca, 2 cr/s). */
export function defaultVoiceForm(): VoiceSettingsForm {
  return formFromSettings(DEFAULT_VOICE_SETTINGS);
}

/** TTS models that speak a language (Aura-1 is English only). */
export function modelsFor(language: TTSLanguage): TTSModelOption[] {
  return TTS_MODEL_OPTIONS.filter((m) => m.languages.includes(language));
}

/** Changing the model picks its first voice for the language. */
export function withVoiceModel(
  form: VoiceSettingsForm,
  language: TTSLanguage,
  model: string,
): VoiceSettingsForm {
  const first = ttsVoicesFor(model, language)[0];
  return {
    ...form,
    voices: {
      ...form.voices,
      [language]: first
        ? { model, voice: first.model, customVoice: "" }
        : { model, voice: CUSTOM_VOICE, customVoice: "" },
    },
  };
}

/** The Deepgram voice id a language row resolves to. */
export function voiceIdOf(entry: VoiceLanguageForm): string {
  return entry.voice === CUSTOM_VOICE ? entry.customVoice.trim() : entry.voice;
}

/** Typed whole minutes as a number (NaN when they aren't). */
export function parseMinutes(raw: string): number {
  const trimmed = raw.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** A typed price as a number (NaN when it isn't one). */
export function parseRate(raw: string): number {
  const trimmed = raw.trim().replace(",", ".");
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function toVoiceSettingsPayload(
  form: VoiceSettingsForm,
): UpdateVoiceSettingsRequest {
  return {
    sttModel: form.sttModel,
    sttCreditsPerSecond: parseRate(form.sttCreditsPerSecond),
    ttsCreditsPerSecond: parseRate(form.ttsCreditsPerSecond),
    ttsVoices: Object.fromEntries(
      TTS_LANGUAGES.map((language) => {
        const entry = form.voices[language];
        return [language, { model: entry.model, voice: voiceIdOf(entry) }];
      }),
    ) as Record<TTSLanguage, TTSLanguageVoice>,
    freeTierMinutes: form.freeTierEnabled
      ? parseMinutes(form.freeTierMinutes)
      : null,
    freeTierPeriod: form.freeTierPeriod,
  };
}

export function validateVoiceForm(form: VoiceSettingsForm): VoiceFormErrors {
  const errors: VoiceFormErrors = {};
  for (const error of voiceSettingsErrors(toVoiceSettingsPayload(form))) {
    errors[error.field] ??= error.code;
  }
  return errors;
}

export function hasVoiceErrors(errors: VoiceFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Whether the form differs from what is saved. */
export function isVoiceFormDirty(
  form: VoiceSettingsForm,
  saved: VoiceSettings,
): boolean {
  return (
    JSON.stringify(toVoiceSettingsPayload(form)) !==
    JSON.stringify(toVoiceSettingsPayload(formFromSettings(saved)))
  );
}

/**
 * What a price means for users: credits for `seconds` of audio, or null
 * while the typed price is not valid.
 */
export function creditsFor(raw: string, seconds: number): number | null {
  const rate = parseRate(raw);
  return isVoiceCreditRate(rate) ? voiceCredits(seconds * 1000, rate) : null;
}
