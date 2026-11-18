import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { ASSET_ENGAGEMENT_MAX_TOP } from "@creator-hub/shared-types";

/** Query of GET /user/assets/engagement. */
export class AssetEngagementQueryDto {
  /** Assets to list (most liked first). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ASSET_ENGAGEMENT_MAX_TOP)
  limit?: number;
}
