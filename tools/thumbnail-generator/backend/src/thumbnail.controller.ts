import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpException,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { ThumbnailService } from "./thumbnail.service";

@Controller("tools/thumbnail-generator")
@UseGuards(JwtAuthGuard)
export class ThumbnailController {
  constructor(private thumbnailService: ThumbnailService) {}

  @Post("generate")
  async generate(
    @CurrentUser("id") userId: string,
    @Body()
    dto: {
      prompt: string;
      negativePrompt?: string;
      style?: string;
      provider?: string;
      width?: number;
      height?: number;
      aspectRatio?: string;
      imageUrl?: string;
    },
  ): Promise<{ success: boolean; data: { jobId: string } }> {
    if (!dto.prompt?.trim()) {
      throw new BadRequestException("Prompt is required");
    }

    try {
      const result = await this.thumbnailService.generate({
        userId,
        prompt: dto.prompt,
        negativePrompt: dto.negativePrompt,
        style: dto.style,
        provider: dto.provider,
        width: dto.width,
        height: dto.height,
        aspectRatio: dto.aspectRatio,
        imageUrl: dto.imageUrl,
      });
      return { success: true, data: result };
    } catch (error) {
      // Re-throw NestJS exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }
      const message = (error as Error).message || "Thumbnail generation failed";
      throw new BadRequestException(message);
    }
  }

  @Get("jobs/:jobId/status")
  async getJobStatus(
    @CurrentUser("id") userId: string,
    @Param("jobId") jobId: string,
  ): Promise<{ status: string; failedReason?: string }> {
    return this.thumbnailService.getJobStatus(jobId, userId);
  }

  @Get("images")
  async getImages(
    @CurrentUser("id") userId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ): Promise<any> {
    return this.thumbnailService.getUserImages(userId, page, limit);
  }
}
