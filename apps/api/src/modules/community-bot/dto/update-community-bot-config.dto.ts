import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateCommunityBotConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  systemPromptExtra?: string;

  @IsOptional()
  @IsBoolean()
  useStyleProfile?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  historyLength?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5000)
  dailyReplyLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  perContactCooldownSec?: number;
}
