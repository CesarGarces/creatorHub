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
import { VideoService } from "./video.service";

@Controller("tools/video-generator")
@UseGuards(JwtAuthGuard)
export class VideoController {
  constructor(private videoService: VideoService) {}

  @Post("generate")
  async generate(
    @CurrentUser("id") userId: string,
    @Body()
    dto: {
      prompt: string;
      imageUrl?: string;
      model?: string;
      provider?: string;
      aspectRatio?: string;
      duration?: number;
      audioEnabled?: boolean;
      quality?: string;
    },
  ): Promise<{ success: boolean; data: { jobId: string } }> {
    if (!dto.prompt?.trim()) {
      throw new BadRequestException("Prompt is required");
    }
    try {
      const result = await this.videoService.generate({
        userId,
        prompt: dto.prompt,
        imageUrl: dto.imageUrl,
        model: dto.model,
        provider: dto.provider,
        aspectRatio: dto.aspectRatio,
        duration: dto.duration,
        audioEnabled: dto.audioEnabled,
        quality: dto.quality,
      });
      return { success: true, data: result };
    } catch (error) {
      // Re-throw NestJS exceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }
      const message = (error as Error).message || "Video generation failed";
      throw new BadRequestException(message);
    }
  }

  @Get("jobs/:jobId/status")
  async getJobStatus(
    @CurrentUser("id") userId: string,
    @Param("jobId") jobId: string,
  ): Promise<{ status: string; failedReason?: string }> {
    return this.videoService.getJobStatus(jobId, userId);
  }

  @Get("videos")
  async getVideos(
    @CurrentUser("id") userId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ): Promise<any> {
    return this.videoService.getUserVideos(userId, page, limit);
  }
}
