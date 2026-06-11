import { Controller, Post, Get, Body, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { ThumbnailService } from "./thumbnail.service";

@Controller("tools/thumbnail-generator")
@UseGuards(JwtAuthGuard)
export class ThumbnailController {
  constructor(private thumbnailService: ThumbnailService) {}

  @Post("generate")
  async generate(
    @CurrentUser("id") userId: string,
    @Body() dto: { prompt: string; negativePrompt?: string; style?: string }
  ): Promise<any> {
    try {
      const result = await this.thumbnailService.generate({
        userId,
        prompt: dto.prompt,
        negativePrompt: dto.negativePrompt,
        style: dto.style,
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  @Get("images")
  async getImages(
    @CurrentUser("id") userId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number
  ): Promise<any> {
    return this.thumbnailService.getUserImages(userId, page, limit);
  }
}
