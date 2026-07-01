import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import {
  JwtAuthGuard,
  CurrentUser,
  AuthenticatedPlanGuard,
  MinPlan,
} from "@creator-hub/auth";
import { XSearchTrendsService } from "./x-search-trends.service";

@Controller("tools/x-search-trends")
@UseGuards(JwtAuthGuard, AuthenticatedPlanGuard)
@MinPlan("STARTER")
export class XSearchTrendsController {
  constructor(private searchService: XSearchTrendsService) {}

  @Post("search")
  async search(
    @CurrentUser("id") userId: string,
    @Body()
    dto: {
      topic: string;
      maxTweets?: number;
      timeframe?: string;
      language?: string;
      includeReplies?: boolean;
      sortBy?: string;
    },
  ): Promise<{ success: boolean; data: any }> {
    if (!dto.topic?.trim()) {
      throw new BadRequestException("Topic is required");
    }

    try {
      const result = await this.searchService.search(userId, {
        topic: dto.topic,
        maxTweets: dto.maxTweets,
        timeframe: dto.timeframe,
        language: dto.language,
        includeReplies: dto.includeReplies,
        sortBy: dto.sortBy,
      });

      return { success: true, data: result };
    } catch (error) {
      const message = (error as Error).message || "X trend search failed";
      if (message.includes("Insufficient credits")) {
        throw new BadRequestException(message);
      }
      throw new InternalServerErrorException(message);
    }
  }
}
