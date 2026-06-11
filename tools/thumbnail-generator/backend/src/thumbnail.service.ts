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
    width?: number;
    height?: number;
  }): Promise<any> {
    const CREDIT_COST = 10;

    const hasCredits = await this.creditService.hasEnoughCredits(params.userId, CREDIT_COST);
    if (!hasCredits) {
      throw new Error("Insufficient credits");
    }

    await this.thumbnailQueue.add("generate-thumbnail", params);

    const startTime = Date.now();

    try {
      const fullPrompt = params.style
        ? `${params.prompt}, ${params.style}`
        : params.prompt;

      const result = await this.aiEngine.generateImage(fullPrompt, {
        negativePrompt: params.negativePrompt,
        width: params.width || 1280,
        height: params.height || 720,
        userId: params.userId,
        toolId: "thumbnail-generator",
      });

      const duration = Date.now() - startTime;

      await this.creditService.deduct(
        params.userId,
        CREDIT_COST,
        "thumbnail-generator",
        `Generated thumbnail: ${params.prompt.slice(0, 50)}...`
      );

      const image = await prisma.generatedImage.create({
        data: {
          userId: params.userId,
          toolId: "thumbnail-generator",
          prompt: params.prompt,
          negativePrompt: params.negativePrompt,
          provider: result.provider,
          model: result.model,
          width: params.width || 1280,
          height: params.height || 720,
          url: (result.output as any).url,
          credits: CREDIT_COST,
        },
      });

      const output = result.output as { type: "image"; url: string; width: number; height: number };

      return {
        id: image.id,
        url: output.url,
        credits: CREDIT_COST,
        duration,
        provider: result.provider,
      };
    } catch (error) {
      this.logger.error("Thumbnail generation failed", { error: (error as Error).message });
      throw error;
    }
  }

  async getUserImages(userId: string, page = 1, limit = 20): Promise<any> {
    const skip = (page - 1) * limit;

    const [images, total] = await Promise.all([
      prisma.generatedImage.findMany({
        where: { userId, toolId: "thumbnail-generator" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.generatedImage.count({
        where: { userId, toolId: "thumbnail-generator" },
      }),
    ]);

    return {
      data: images,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
