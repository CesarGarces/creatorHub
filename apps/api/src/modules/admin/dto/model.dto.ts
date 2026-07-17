import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from "class-validator";

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
