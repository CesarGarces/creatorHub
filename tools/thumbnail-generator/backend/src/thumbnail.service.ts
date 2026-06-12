import { Injectable } from "@nestjs/common";
import { AIEngineService } from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class ThumbnailService {
  private logger = new Logger("ThumbnailService");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private storageService: StorageService,
    @InjectQueue("thumbnail-generation") private thumbnailQueue: Queue
  ) {}

  async generate(params: {
    userId: string;
    prompt: string;
    negativePrompt?: string;
    style?: string;
    provider?: string;
    width?: number;
    height?: number;
  }): Promise<any> {
    const CREDIT_COST = 10;

    const hasCredits = await this.creditService.hasEnoughCredits(params.userId, CREDIT_COST);
    if (!hasCredits) {
      throw new Error("Insufficient credits");
    }

    const startTime = Date.now();

    try {
      const fullPrompt = params.style
        ? `${params.prompt}, ${params.style}`
        : params.prompt;

      const result = await this.aiEngine.generateImage(fullPrompt, {
        provider: params.provider as any,
        negativePrompt: params.negativePrompt,
        width: params.width || 1280,
        height: params.height || 720,
        userId: params.userId,
        toolId: "thumbnail-generator",
      });

      const duration = Date.now() - startTime;

      const output = result.output as { type: string; url: string };
      if (!output?.url) {
        throw new Error("AI provider returned no image URL");
      }

      let finalUrl = output.url;

      if (output.url.startsWith("data:image")) {
        const base64Data = output.url.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid base64 image data");
        }
        const buffer = Buffer.from(base64Data, "base64");
        const file = await this.storageService.upload(
          buffer,
          `thumbnail-${Date.now()}.png`,
          "image/png",
          params.userId,
          "thumbnail-generator"
        );
        finalUrl = file.signedUrl;
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
          const file = await this.storageService.upload(
            buffer,
            `thumbnail-${Date.now()}.${ext}`,
            contentType,
            params.userId,
            "thumbnail-generator"
          );
          finalUrl = file.signedUrl;
        } catch (fetchError) {
          this.logger.warn("Failed to download image from provider, using remote URL", {
            error: (fetchError as Error).message,
          });
        }
      }

      if (!finalUrl) {
        throw new Error("Image generation failed: no valid URL after processing");
      }

      await this.creditService.deduct(
        params.userId,
        CREDIT_COST,
        "thumbnail-generator",
        `Generated thumbnail: ${params.prompt.slice(0, 50)}...`
      );

      const image = await prisma.generatedImage.create({
        data: {
          userId: params.userId,
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          provider: result.provider,
          storageProvider: this.storageService.getProvider(),
          model: result.model,
          width: params.width || 1280,
          height: params.height || 720,
          url: finalUrl,
          credits: CREDIT_COST,
        },
      });

      return {
        id: image.id,
        url: finalUrl,
        credits: CREDIT_COST,
        duration,
        provider: result.provider,
      };
    } catch (error) {
      const message = (error as Error).message || "Thumbnail generation failed";
      this.logger.error("Thumbnail generation failed", { error: message });
      throw new Error(message);
    }
  }

  async getUserImages(userId: string, page = 1, limit = 20): Promise<any> {
    const skip = (page - 1) * limit;

    const [images, total] = await Promise.all([
      prisma.generatedImage.findMany({
        where: { userId, toolId: "thumbnail-generator", storageProvider: this.storageService.getProvider() },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.generatedImage.count({
        where: { userId, toolId: "thumbnail-generator", storageProvider: this.storageService.getProvider() },
      }),
    ]);

    return {
      data: images,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
