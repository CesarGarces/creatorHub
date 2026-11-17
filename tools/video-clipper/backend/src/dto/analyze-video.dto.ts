import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  ANALYSIS_LANGUAGES,
  CLIP_PLATFORMS,
  FRAME_DATA_URL_PATTERN,
  MAX_CONTEXT_CHARS,
  MAX_DURATION_SEC,
  MAX_FRAME_DATA_URL_CHARS,
  MAX_FRAMES,
  MAX_VIDEO_BYTES,
  MIN_FRAMES,
  type AnalysisLanguage,
  type ClipPlatform,
} from "../video-clipper.constants";

const FINITE = { allowNaN: false, allowInfinity: false };

/** One keyframe sampled by the browser (canvas → compressed data URL). */
export class VideoFrameDto {
  @IsNumber(FINITE)
  @Min(0)
  @Max(MAX_DURATION_SEC)
  timestamp!: number;

  @IsString()
  @MaxLength(MAX_FRAME_DATA_URL_CHARS, {
    message: "Each keyframe must be smaller than 450 KB",
  })
  @Matches(FRAME_DATA_URL_PATTERN, {
    message: "Keyframes must be JPEG, PNG or WebP data URLs",
  })
  image!: string;
}

/** Metadata of the local file. The file itself is never uploaded. */
export class VideoMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsNumber(FINITE)
  @Min(0.5)
  @Max(MAX_DURATION_SEC, {
    message: "Videos longer than 6 hours are not supported",
  })
  durationSec!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16_384)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16_384)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES, {
    message: "Videos larger than 250 MB are not supported yet",
  })
  sizeBytes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;
}

/** Body of POST /tools/video-clipper/analyses. */
export class AnalyzeVideoDto {
  /** Vision model (ModelMetadata.modelId) picked in the model selector. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model!: string;

  @ValidateNested()
  @Type(() => VideoMetadataDto)
  video!: VideoMetadataDto;

  @IsArray()
  @ArrayMinSize(MIN_FRAMES)
  @ArrayMaxSize(MAX_FRAMES, { message: `Send at most ${MAX_FRAMES} keyframes` })
  @ValidateNested({ each: true })
  @Type(() => VideoFrameDto)
  frames!: VideoFrameDto[];

  @IsOptional()
  @IsIn(CLIP_PLATFORMS)
  platform?: ClipPlatform;

  @IsOptional()
  @IsIn(ANALYSIS_LANGUAGES)
  language?: AnalysisLanguage;

  /** Optional creator notes ("what is this video about?"). */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_CONTEXT_CHARS)
  context?: string;
}

/** Query of GET /tools/video-clipper/estimate. */
export class EstimateAnalysisQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  model!: string;

  @Type(() => Number)
  @IsInt()
  @Min(MIN_FRAMES)
  @Max(MAX_FRAMES)
  frames!: number;
}

/** Query of GET /tools/video-clipper/analyses. */
export class ListAnalysesQueryDto {
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
