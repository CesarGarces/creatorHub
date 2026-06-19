import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  Min,
} from "class-validator";

export class CreateCreditPlanDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0.01)
  usdAmount!: number;

  @IsNumber()
  @Min(1)
  creditsGiven!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}

export class UpdateCreditPlanDto {
  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.01)
  usdAmount?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  creditsGiven?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
