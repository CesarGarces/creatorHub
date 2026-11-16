import { Transform } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CONTENT_PLATFORMS } from "../content-planner.constants";
import { PLAN_LANGUAGES, type PlanLanguage } from "./ai-plan.types";

/** Multipart fields of POST /tools/content-planner/ai-plans (files: "files"). */
export class AnalyzePlanDto {
  /** Text model (ModelMetadata.modelId) picked in the model selector. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  idea?: string;

  /** Voice notes transcribed with speech-to-text. */
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  transcript?: string;

  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsIn(CONTENT_PLATFORMS)
  platform?: string;

  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @IsISO8601({ strict: true })
  publishDate?: string;

  @IsOptional()
  @IsIn(PLAN_LANGUAGES)
  language?: PlanLanguage;
}

export class EstimatePlanQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model!: string;
}
