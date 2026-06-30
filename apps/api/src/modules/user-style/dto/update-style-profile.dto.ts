import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  MaxLength,
} from "class-validator";

export class UpdateStyleProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tone?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vocabKeywords?: string[];

  @IsOptional()
  @IsIn(["short", "medium", "long"])
  sentenceLength?: "short" | "medium" | "long";

  @IsOptional()
  @IsIn(["none", "low", "moderate", "high"])
  emojiUsage?: "none" | "low" | "moderate" | "high";

  @IsOptional()
  @IsIn(["casual", "semi-formal", "formal"])
  formalityLevel?: "casual" | "semi-formal" | "formal";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;
}
