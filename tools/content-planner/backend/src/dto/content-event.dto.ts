import { Type } from "class-transformer";
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { CreateCustomTypeDto } from "./custom-type.dto";
import {
  CONTENT_EVENT_STATUSES,
  CONTENT_EVENT_TYPES,
  LIMITS,
  type ContentEventStatusValue,
  type ContentEventTypeValue,
} from "../content-planner.constants";

/** A session as sent when it is created together with its project. */
export class ProjectEventInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.titleMaxLength)
  title!: string;

  @IsIn(CONTENT_EVENT_TYPES)
  type!: ContentEventTypeValue;

  @IsOptional()
  @IsIn(CONTENT_EVENT_STATUSES)
  status?: ContentEventStatusValue;

  @IsISO8601({ strict: true })
  startAt!: string;

  @IsISO8601({ strict: true })
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(LIMITS.notesMaxLength)
  notes?: string;
}

/**
 * A session created with its project ("Plan a video"). A customised
 * production step sends its look as `customType`: the API reuses the user's
 * custom type with that name (updating its color/icon) or creates it.
 */
export class PlannedEventInputDto extends ProjectEventInputDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateCustomTypeDto)
  customType?: CreateCustomTypeDto;
}

export class CreateContentEventDto extends ProjectEventInputDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;

  /** A custom type of the user; the session's `type` is then OTHER. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  customTypeId?: string;
}

/** Partial update. `null` clears `projectId` / `notes` / `customTypeId`. */
export class UpdateContentEventDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.titleMaxLength)
  title?: string;

  @IsOptional()
  @IsIn(CONTENT_EVENT_TYPES)
  type?: ContentEventTypeValue;

  @IsOptional()
  @IsIn(CONTENT_EVENT_STATUSES)
  status?: ContentEventStatusValue;

  @IsOptional()
  @IsISO8601({ strict: true })
  startAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  endAt?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(LIMITS.notesMaxLength)
  notes?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  projectId?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsNotEmpty()
  customTypeId?: string | null;
}

export class ListContentEventsQueryDto {
  @IsISO8601({ strict: true })
  from!: string;

  @IsISO8601({ strict: true })
  to!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;
}
