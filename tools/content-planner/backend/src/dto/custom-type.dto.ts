import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import {
  LIMITS,
  PALETTE_COLORS,
  PALETTE_ICONS,
  type PaletteColor,
  type PaletteIcon,
} from "../content-planner.constants";

export class CreateCustomTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.customTypeNameMaxLength)
  name!: string;

  @IsIn(PALETTE_COLORS)
  color!: PaletteColor;

  /** Defaults to "tag". */
  @IsOptional()
  @IsIn(PALETTE_ICONS)
  icon?: PaletteIcon;
}

export class CreateCustomPlatformDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(LIMITS.customPlatformNameMaxLength)
  name!: string;
}
