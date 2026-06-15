import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  Min,
  IsBoolean,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export enum ProviderTierDto {
  FREE = "FREE",
  PRO = "PRO",
}

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsEnum(ProviderTierDto)
  tier!: ProviderTierDto;

  @IsInt()
  @Min(1)
  costPerCredit!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  supportedTasks!: string[];

  @IsOptional()
  config?: Record<string, unknown>;
}

export class UpdateProviderDto extends PartialType(CreateProviderDto) {}
