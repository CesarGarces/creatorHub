import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { CREDIT_STATES, type CreditState } from "@creator-hub/shared-types";

/** Button links must be http(s) or the {{purchaseUrl}} variable. */
const CTA_URL_PATTERN = /^(https?:\/\/\S+|\{\{\s*purchaseUrl\s*\}\})$/i;
const CTA_URL_MESSAGE = "ctaUrl must be an http(s) URL or {{purchaseUrl}}";

class CreditEmailContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  heading!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaLabel?: string | null;

  @IsOptional()
  @ValidateIf((o) => Boolean(o.ctaUrl))
  @IsString()
  @MaxLength(500)
  @Matches(CTA_URL_PATTERN, { message: CTA_URL_MESSAGE })
  ctaUrl?: string | null;
}

export class CreateCreditEmailTriggerDto extends CreditEmailContentDto {
  @IsIn(CREDIT_STATES)
  state!: CreditState;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCreditEmailTriggerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  heading?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  ctaLabel?: string | null;

  @IsOptional()
  @ValidateIf((o) => Boolean(o.ctaUrl))
  @IsString()
  @MaxLength(500)
  @Matches(CTA_URL_PATTERN, { message: CTA_URL_MESSAGE })
  ctaUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PreviewCreditEmailDto extends CreditEmailContentDto {
  @IsIn(CREDIT_STATES)
  state!: CreditState;
}
