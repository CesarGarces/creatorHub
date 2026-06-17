import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { ContentTranslatorService } from "./content-translator.service";

@Controller("tools/content-translator")
@UseGuards(JwtAuthGuard)
export class ContentTranslatorController {
  constructor(private contentTranslatorService: ContentTranslatorService) {}

  @Post("translate")
  async translate(
    @CurrentUser("id") userId: string,
    @Body()
    dto: {
      text: string;
      targetLanguage: string;
      provider?: string;
    },
  ): Promise<{ success: boolean; data: { jobId: string } }> {
    if (!dto.text?.trim()) {
      throw new BadRequestException("Text is required");
    }
    if (!dto.targetLanguage?.trim()) {
      throw new BadRequestException("Target language is required");
    }

    try {
      const result = await this.contentTranslatorService.translate({
        userId,
        text: dto.text,
        targetLanguage: dto.targetLanguage,
        provider: dto.provider,
      });
      return { success: true, data: result };
    } catch (error) {
      const message =
        (error as Error).message || "Translation generation failed";
      if (
        message.includes("Insufficient credits") ||
        message.includes("only available on paid plans")
      ) {
        throw new BadRequestException(message);
      }
      throw new InternalServerErrorException(message);
    }
  }

  @Get("jobs/:jobId/status")
  async getJobStatus(
    @CurrentUser("id") userId: string,
    @Param("jobId") jobId: string,
  ): Promise<{ status: string; failedReason?: string }> {
    return this.contentTranslatorService.getJobStatus(jobId, userId);
  }

  @Get("translations")
  async getTranslations(
    @CurrentUser("id") userId: string,
    @Query("page") page?: number,
    @Query("limit") limit?: number,
  ): Promise<{
    data: unknown[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.contentTranslatorService.getUserTranslations(
      userId,
      page,
      limit,
    );
  }
}
