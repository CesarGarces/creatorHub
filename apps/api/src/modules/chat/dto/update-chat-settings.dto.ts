import { IsOptional, IsString, IsNumber, Min, Max } from "class-validator";

export class UpdateChatSettingsDto {
  @IsOptional()
  @IsString()
  defaultModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(256)
  @Max(16000)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  reasoning?: number;
}
