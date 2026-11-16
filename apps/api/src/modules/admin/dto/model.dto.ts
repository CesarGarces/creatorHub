import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  Matches,
  MaxLength,
  ArrayMaxSize,
  Min,
  Max,
} from "class-validator";

/** Providers a model can be added for (runtime implementations exist). */
export const MODEL_PROVIDER_SLUGS = [
  "openrouter",
  "siliconflow",
  "deepgram",
] as const;

/**
 * Task types of models. "embedding" powers the vector RAG layer and
 * "speech-to-text" prices voice input (credits per minute).
 */
export const MODEL_TASK_TYPES = [
  "text-generation",
  "image-generation",
  "video-generation",
  "embedding",
  "speech-to-text",
] as const;

/** Task types that generate content and get a matching Provider row. */
export const GENERATIVE_TASK_TYPES = [
  "text-generation",
  "image-generation",
  "video-generation",
];

/** "Add model" in Admin → AI Models. */
export class CreateModelDto {
  @IsIn(MODEL_PROVIDER_SLUGS)
  providerSlug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/^[\w.\-/:@]+$/, {
    message: "modelId may only contain letters, numbers and . - _ / : @",
  })
  modelId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  displayName!: string;

  @IsIn(MODEL_TASK_TYPES)
  taskType!: string;

  @IsIn(["FREE", "PRO"])
  tier!: "FREE" | "PRO";

  @IsInt()
  @Min(0)
  @Max(1000)
  creditCost!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  contextLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxOutputTokens?: number;

  @IsOptional()
  @IsBoolean()
  supportsStreaming?: boolean;

  @IsOptional()
  @IsBoolean()
  supportsVision?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ModelFilterDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  providerSlug?: string;

  @IsOptional()
  @IsString()
  taskType?: string;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(["default", "newest", "oldest"])
  sort?: "default" | "newest" | "oldest";
}

export class ModelConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  creditCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  profitMargin?: number;
}

export class BulkModelConfigDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  creditCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  profitMargin?: number;
}

export class ModelSyncResultDto {
  total!: number;
  created!: number;
  updated!: number;
  deactivated!: number;
}
