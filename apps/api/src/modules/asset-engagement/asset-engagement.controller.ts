import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import type { AssetEngagement } from "@creator-hub/shared-types";
import { AssetEngagementService } from "./asset-engagement.service";
import { AssetEngagementQueryDto } from "./dto/asset-engagement-query.dto";

/** Likes & views of the signed-in user's assets (dashboard widget). */
@Controller("user/assets")
@UseGuards(JwtAuthGuard)
export class AssetEngagementController {
  constructor(private readonly engagement: AssetEngagementService) {}

  @Get("engagement")
  getEngagement(
    @CurrentUser("id") userId: string,
    @Query() query: AssetEngagementQueryDto,
  ): Promise<AssetEngagement> {
    return this.engagement.getEngagement(userId, query.limit);
  }
}
