import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { prisma } from "@creator-hub/database";

@Controller("images")
@UseGuards(JwtAuthGuard)
export class ImagesController {
  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private storageService: StorageService
  ) {}

  @Get()
  async listImages(
    @CurrentUser("id") userId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ): Promise<{ data: any[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const pageNum = parseInt(page || "1");
    const limitNum = parseInt(limit || "20");
    const skip = (pageNum - 1) * limitNum;

    const [images, total] = await Promise.all([
      prisma.generatedImage.findMany({
        where: { userId, storageProvider: this.storageService.getProvider() },
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.generatedImage.count({ where: { userId, storageProvider: this.storageService.getProvider() } }),
    ]);

    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        let url = img.url || "";
        if (img.url && !img.url.startsWith("http")) {
          const parts = img.url.split("/");
          const bucket = parts[0] || "";
          const key = parts.slice(1).join("/");
          if (bucket && key) {
            try {
              url = await this.storageService.getPresignedDownloadUrl(bucket, key, 3600);
            } catch {
              url = img.url;
            }
          }
        }
        return { ...img, url };
      })
    );

    return {
      data: imagesWithUrls,
      meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    };
  }

  @Delete(":id")
  async deleteImage(
    @CurrentUser("id") userId: string,
    @Param("id") id: string
  ): Promise<{ success: boolean }> {
    const image = await prisma.generatedImage.findFirst({
      where: { id, userId },
    });

    if (!image) {
      throw new NotFoundException("Image not found");
    }

    await prisma.generatedImage.delete({ where: { id } });

    return { success: true };
  }

  @Post("generate")
  async generateImage(
    @CurrentUser("id") userId: string,
    @Body() dto: { prompt: string; toolId: string; provider?: string }
  ) {
    if (!dto.prompt?.trim()) {
      throw new BadRequestException("Prompt is required");
    }

    const hasCredits = await this.creditService.hasEnoughCredits(userId, 10);
    if (!hasCredits) {
      throw new BadRequestException("Insufficient credits");
    }

    try {
      const result = await this.aiEngine.generateImage(dto.prompt, {
        provider: dto.provider as any,
        userId,
        toolId: dto.toolId,
      });

      const output = result.output as { type: string; url: string };
      if (!output?.url) {
        throw new Error("AI provider returned no image URL");
      }

      let finalUrl = output.url;

      const bucket = this.storageService.getDefaultBucket();

      if (output.url.startsWith("data:image")) {
        const base64Data = output.url.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 image data");
        }
        const buffer = Buffer.from(base64Data, "base64");
        const key = `${userId}/${Date.now()}-generated.png`;
        const uploadResult = await this.storageService.uploadBuffer(
          bucket,
          key,
          buffer,
          "image/png"
        );
        finalUrl = await this.storageService.getPresignedDownloadUrl(
          uploadResult.bucket,
          uploadResult.key,
          7 * 24 * 60 * 60
        );
      } else if (output.url.startsWith("http")) {
        try {
          const response = await fetch(output.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch image from provider: ${response.status}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const contentType = response.headers.get("content-type") || "image/png";
          const ext = contentType.includes("jpeg") ? "jpg" : "png";
          const key = `${userId}/${Date.now()}-generated.${ext}`;
          const uploadResult = await this.storageService.uploadBuffer(
            bucket,
            key,
            buffer,
            contentType
          );
          finalUrl = await this.storageService.getPresignedDownloadUrl(
            uploadResult.bucket,
            uploadResult.key,
            7 * 24 * 60 * 60
          );
        } catch (fetchError) {
          this.logger.warn("Failed to download image from provider, using remote URL", {
            error: (fetchError as Error).message,
          });
        }
      }

      if (!finalUrl) {
        throw new Error("Image generation failed: no valid URL after processing");
      }

      await prisma.generatedImage.create({
        data: {
          userId,
          toolId: dto.toolId,
          prompt: dto.prompt,
          provider: dto.provider || "unknown",
          storageProvider: this.storageService.getProvider(),
          model: (result as any).model || "unknown",
          width: (result as any).width || 0,
          height: (result as any).height || 0,
          url: finalUrl,
          credits: 10,
        },
      });

      await this.creditService.deduct(userId, 10, dto.toolId, "Image generation");

      return {
        success: true,
        data: { ...result, output: { ...result.output, url: finalUrl } },
      };
    } catch (error) {
      const message = (error as Error).message || "Unknown error";
      this.logger.error("Image generation failed", { error: message });

      if (message.includes("billing limit")) {
        throw new BadRequestException(
          "The AI provider's billing limit has been reached. Please try a different provider or contact support."
        );
      }

      if (message.includes("rate limit")) {
        throw new BadRequestException(
          "Too many requests to the AI provider. Please try again in a few moments."
        );
      }

      if (message.includes("API key")) {
        throw new InternalServerErrorException(
          "AI provider configuration error. Please contact support."
        );
      }

      throw new InternalServerErrorException(
        `Image generation failed: ${message}`
      );
    }
  }

  private logger = { warn: console.warn, error: console.error };
}
