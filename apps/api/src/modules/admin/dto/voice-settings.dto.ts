import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import {
  FREE_TIER_PERIODS,
  TTS_LANGUAGES,
  type FreeTierPeriod,
  type TTSLanguage,
  type TTSLanguageVoice,
  type UpdateVoiceSettingsRequest,
} from "@creator-hub/shared-types";

/**
 * `PUT /admin/voice-settings`. Shapes are checked here; the rules (known
 * models, voice ids per language, prices 0–100 cr/s in cents, 1–10,000
 * free minutes) are `voiceSettingsErrors`, applied by VoiceSettingsService.
 */
export class UpdateVoiceSettingsDto implements UpdateVoiceSettingsRequest {
  @IsString()
  sttModel!: string;

  @IsNumber()
  sttCreditsPerSecond!: number;

  @IsNumber()
  ttsCreditsPerSecond!: number;

  @IsObject()
  ttsVoices!: Record<TTSLanguage, TTSLanguageVoice>;

  /** Free plan minutes with Robotina; null = no limit. */
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  freeTierMinutes!: number | null;

  @IsIn(FREE_TIER_PERIODS)
  freeTierPeriod!: FreeTierPeriod;
}

/** `POST /admin/voice-settings/preview`: hear a voice before saving it. */
export class PreviewVoiceDto {
  @IsIn(TTS_LANGUAGES)
  language!: TTSLanguage;

  @IsString()
  @Matches(/^aura(-2)?-[a-z][a-z0-9]{1,30}-[a-z]{2}$/)
  voice!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  text?: string;
}
