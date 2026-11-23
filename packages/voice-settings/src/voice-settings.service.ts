import { BadRequestException, Injectable } from "@nestjs/common";
import { prisma, type Prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import {
  DEFAULT_VOICE_SETTINGS,
  FREE_TIER_PERIODS,
  TTS_LANGUAGES,
  isFreeTierMinutes,
  isSTTModel,
  isTTSLanguage,
  isTTSVoiceId,
  isVoiceCreditRate,
  ttsVoiceInfo,
  voiceSettingsErrors,
  type FreeTierPeriod,
  type TTSLanguage,
  type TTSLanguageVoice,
  type TTSVoiceOption,
  type UpdateVoiceSettingsRequest,
  type VoiceSettings,
} from "@creator-hub/shared-types";

/** The single settings row. */
export const VOICE_SETTINGS_ID = "global";
/** How long a read is reused (every voice session and reply reads it). */
export const VOICE_SETTINGS_CACHE_MS = 30_000;

interface VoiceSettingsRow {
  sttModel: string;
  sttCreditsPerMinute: number;
  ttsCreditsPerMinute: number;
  ttsVoices: unknown;
  freeTierMinutes?: number | null;
  freeTierPeriod?: string | null;
  updatedAt: Date;
}

/**
 * The platform's voice configuration (Admin → Voice: STT & TTS): the
 * Deepgram speech-to-text model, the Deepgram voice of each language and the
 * prices per minute.
 *
 * Read on every voice session and spoken reply, so reads are cached for
 * 30 s (a save refreshes this instance at once; other API replicas within
 * the cache time). Reading never fails: a missing row, a database error or
 * an invalid stored value fall back to the last good value or the
 * defaults, so billing and speech keep working.
 */
@Injectable()
export class VoiceSettingsService {
  private readonly logger = new Logger("VoiceSettingsService");
  private cache: { value: VoiceSettings; at: number } | null = null;
  private pending: Promise<VoiceSettings> | null = null;

  async get(now = Date.now()): Promise<VoiceSettings> {
    if (this.cache && now - this.cache.at < VOICE_SETTINGS_CACHE_MS) {
      return this.cache.value;
    }
    this.pending ??= this.load(now).finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  /** The voice ("actor") that speaks a language. */
  async voiceFor(language: unknown): Promise<TTSVoiceOption> {
    const settings = await this.get();
    const lang: TTSLanguage = isTTSLanguage(language) ? language : "en";
    return ttsVoiceInfo(settings.tts.voices[lang].voice, lang);
  }

  /** Saves new settings (validated) and returns them. */
  async update(
    input: UpdateVoiceSettingsRequest,
    adminId?: string,
  ): Promise<VoiceSettings> {
    const errors = voiceSettingsErrors(input);
    if (errors.length > 0) {
      throw new BadRequestException(
        `Invalid voice settings: ${errors
          .map((e) => `${e.field} (${e.code})`)
          .join(", ")}`,
      );
    }
    const ttsVoices = Object.fromEntries(
      TTS_LANGUAGES.map((language) => [
        language,
        {
          model: input.ttsVoices[language].model,
          voice: input.ttsVoices[language].voice,
        },
      ]),
    ) as unknown as Prisma.InputJsonValue;
    const data = {
      sttModel: input.sttModel,
      sttCreditsPerMinute: input.sttCreditsPerMinute,
      ttsCreditsPerMinute: input.ttsCreditsPerMinute,
      ttsVoices,
      freeTierMinutes: input.freeTierMinutes,
      freeTierPeriod: input.freeTierPeriod,
      updatedById: adminId ?? null,
    };
    const row = await prisma.voiceSettings.upsert({
      where: { id: VOICE_SETTINGS_ID },
      create: { id: VOICE_SETTINGS_ID, ...data },
      update: data,
    });
    const value = toVoiceSettings(row);
    this.cache = { value, at: Date.now() };
    this.logger.info("Voice settings updated", {
      adminId,
      sttModel: value.stt.model,
      sttCreditsPerMinute: value.stt.creditsPerMinute,
      ttsCreditsPerMinute: value.tts.creditsPerMinute,
      voices: TTS_LANGUAGES.map((l) => value.tts.voices[l].voice).join(","),
      freeTierMinutes: value.freeTier.minutes,
      freeTierPeriod: value.freeTier.period,
    });
    return value;
  }

  /** Forgets the cached value (next read goes to the database). */
  invalidate(): void {
    this.cache = null;
  }

  private async load(now: number): Promise<VoiceSettings> {
    try {
      const row = await prisma.voiceSettings.findUnique({
        where: { id: VOICE_SETTINGS_ID },
      });
      const value = row ? toVoiceSettings(row) : defaults();
      this.cache = { value, at: now };
      return value;
    } catch (error) {
      this.logger.warn("Voice settings unavailable, using the last known", {
        error: (error as Error).message,
      });
      // Retry soon rather than hammering a failing database on every call.
      const value = this.cache?.value ?? defaults();
      this.cache = { value, at: now - VOICE_SETTINGS_CACHE_MS + 5_000 };
      return value;
    }
  }
}

function defaults(): VoiceSettings {
  return {
    ...DEFAULT_VOICE_SETTINGS,
    freeTier: { ...DEFAULT_VOICE_SETTINGS.freeTier },
    stt: { ...DEFAULT_VOICE_SETTINGS.stt },
    tts: {
      ...DEFAULT_VOICE_SETTINGS.tts,
      voices: { ...DEFAULT_VOICE_SETTINGS.tts.voices },
    },
  };
}

/**
 * The stored row as settings. Anything invalid (edited by hand, an old
 * shape) falls back field by field to the defaults.
 */
export function toVoiceSettings(row: VoiceSettingsRow): VoiceSettings {
  const d = DEFAULT_VOICE_SETTINGS;
  const stored = (
    row.ttsVoices && typeof row.ttsVoices === "object" ? row.ttsVoices : {}
  ) as Partial<Record<string, Partial<TTSLanguageVoice>>>;
  const voices = Object.fromEntries(
    TTS_LANGUAGES.map((language) => {
      const entry = stored[language];
      const ok =
        typeof entry?.model === "string" &&
        typeof entry.voice === "string" &&
        isTTSVoiceId(entry.model, entry.voice, language);
      return [
        language,
        ok
          ? { model: entry!.model!, voice: entry!.voice! }
          : { ...d.tts.voices[language] },
      ];
    }),
  ) as Record<TTSLanguage, TTSLanguageVoice>;
  return {
    stt: {
      provider: "deepgram",
      model: isSTTModel(row.sttModel) ? row.sttModel : d.stt.model,
      creditsPerMinute: isVoiceCreditRate(row.sttCreditsPerMinute)
        ? row.sttCreditsPerMinute
        : d.stt.creditsPerMinute,
    },
    tts: {
      provider: "deepgram",
      creditsPerMinute: isVoiceCreditRate(row.ttsCreditsPerMinute)
        ? row.ttsCreditsPerMinute
        : d.tts.creditsPerMinute,
      voices,
    },
    freeTier: {
      minutes: isFreeTierMinutes(row.freeTierMinutes)
        ? row.freeTierMinutes
        : null,
      period: FREE_TIER_PERIODS.includes(row.freeTierPeriod as FreeTierPeriod)
        ? (row.freeTierPeriod as FreeTierPeriod)
        : d.freeTier.period,
    },
    updatedAt: row.updatedAt.toISOString(),
  };
}
