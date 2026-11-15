import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import {
  CONTENT_EVENT_TYPES,
  LIMITS,
  PALETTE_COLORS,
  PALETTE_ICONS,
  type ContentEventTypeValue,
} from "../content-planner.constants";

const notNull = (_: unknown, value: unknown) =>
  value !== null && value !== undefined;

/** One step of the user's production template. */
export class ProductionStepDto {
  /** Built-in type the step comes from (absent for steps the user added). */
  @IsOptional()
  @IsIn(CONTENT_EVENT_TYPES)
  baseType?: ContentEventTypeValue;

  /** null = the built-in type's name. Required for added steps. */
  @ValidateIf(notNull)
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.stepNameMaxLength)
  name?: string | null;

  @ValidateIf(notNull)
  @IsIn(PALETTE_COLORS)
  color?: string | null;

  @ValidateIf(notNull)
  @IsIn(PALETTE_ICONS)
  icon?: string | null;

  @IsInt()
  @Min(LIMITS.minStepMinutes)
  @Max(LIMITS.maxStepMinutes)
  durationMinutes!: number;

  @IsBoolean()
  enabled!: boolean;

  @IsBoolean()
  isPublish!: boolean;
}

export class SaveProductionStepsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(LIMITS.maxProductionSteps)
  @ValidateNested({ each: true })
  @Type(() => ProductionStepDto)
  steps!: ProductionStepDto[];
}
