import {
  Controller,
  Post,
  Get,
  Param,
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
import { PostPublisherService } from "./services/post-publisher.service";

@Controller("tools/x-post-tweet")
@UseGuards(JwtAuthGuard, AuthenticatedPlanGuard)
@MinPlan("STARTER")
export class XPostTweetController {
  constructor(private publisherService: PostPublisherService) {}

  @Post("publish/:draftId")
  async publish(
    @CurrentUser("id") userId: string,
    @Param("draftId") draftId: string,
  ): Promise<{ success: boolean; data: any }> {
    try {
      const result = await this.publisherService.publishDraft({
        userId,
        draftId,
        accessToken: "",
      });

      return { success: true, data: result };
    } catch (error) {
      const message = (error as Error).message || "Failed to publish tweet";
      if (message.includes("Insufficient credits")) {
        throw new BadRequestException(message);
      }
      throw new InternalServerErrorException(message);
    }
  }

  @Get("published")
  async getPublished(
    @CurrentUser("id") userId: string,
  ): Promise<{ success: boolean; data: any[] }> {
    const tweets = await this.publisherService.getPublishedTweets(userId);
    return { success: true, data: tweets };
  }
}
