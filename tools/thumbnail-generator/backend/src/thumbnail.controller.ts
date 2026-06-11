import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
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
    @Body() dto: { prompt: string; negativePrompt?: string; style?: string; provider?: string }
  ): Promise<any> {
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
      });
      return { success: true, data: result };
    } catch (error) {
      const message = (error as Error).message || "Thumbnail generation failed";
      if (message.includes("Insufficient credits")) {
        throw new BadRequestException(message);
      }
      throw new InternalServerErrorException(message);
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
