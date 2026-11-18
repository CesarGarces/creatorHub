import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TTS_LANGUAGES, type TTSLanguage } from "@creator-hub/shared-types";
import {
  MAX_MAX_TOKENS,
  MIN_MAX_TOKENS,
  VOICE_ASSISTANT_MAX_MESSAGE_CHARS,
} from "../voice-assistant.constants";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/** Body of POST /tools/voice-assistant/messages (the reply streams as SSE). */
export class SendMessageDto {
  /** Continue this conversation; omitted = start a new one. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;

  /** What the user typed or said (STT transcript). */
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(VOICE_ASSISTANT_MAX_MESSAGE_CHARS)
  content!: string;

  /** The user spoke: Robotina answers with her voice (Aura-2). */
  @IsBoolean()
  spoken!: boolean;

  /** Text model (ModelMetadata.modelId) chosen in the model settings. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model!: string;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_MAX_TOKENS)
  @Max(MAX_MAX_TOKENS)
  maxTokens?: number;

  /** Interface language: used only when the message's language is unclear. */
  @IsOptional()
  @IsIn(TTS_LANGUAGES)
  languageHint?: TTSLanguage;

  /**
   * IANA time zone of the browser ("America/Bogota") for the dates and
   * times of actions. Unknown zones fall back to UTC in the service.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}

export class ListConversationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
