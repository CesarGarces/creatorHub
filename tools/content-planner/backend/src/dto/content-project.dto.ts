import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CONTENT_PLATFORMS, LIMITS } from "../content-planner.constants";
import { PlannedEventInputDto } from "./content-event.dto";

export class CreateContentProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.titleMaxLength)
  title!: string;

  @IsOptional()
  @IsIn(CONTENT_PLATFORMS)
  platform?: string;

  /** A custom platform of the user (takes precedence over `platform`). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customPlatformId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  publishAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.notesMaxLength)
  notes?: string;

  /** The AI plan this project comes from ("Add to calendar"). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  aiPlanId?: string;

  /** Production sessions to schedule together with the project. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIMITS.maxEventsPerProject)
  @ValidateNested({ each: true })
  @Type(() => PlannedEventInputDto)
  events?: PlannedEventInputDto[];
}

/** Partial update. `null` clears the optional fields. */
export class UpdateContentProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.titleMaxLength)
  title?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn(CONTENT_PLATFORMS)
  platform?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  customPlatformId?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsISO8601({ strict: true })
  publishAt?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(LIMITS.notesMaxLength)
  notes?: string | null;
}
