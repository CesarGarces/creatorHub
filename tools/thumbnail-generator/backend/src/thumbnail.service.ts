import { Injectable } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { AIEngineService } from "@creator-hub/ai-engine";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { getFriendlyError } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

export interface EnqueuedThumbnail {
  jobId: string;
}

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
  }): Promise<EnqueuedThumbnail> {
    const CREDIT_COST = 10;

    const hasCredits = await this.creditService.hasEnoughCredits(params.userId, CREDIT_COST);
    if (!hasCredits) {
      throw new Error("Insufficient credits");
    }

    const job = await this.thumbnailQueue.add("generate", {
      userId: params.userId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      style: params.style,
      provider: params.provider,
      width: params.width || 1280,
      height: params.height || 720,
      creditCost: CREDIT_COST,
    });

    this.logger.info(`Thumbnail job enqueued`, { jobId: job.id, userId: params.userId });

    return { jobId: job.id! };
  }

  async getJobStatus(jobId: string, userId: string): Promise<{ status: string; failedReason?: string }> {
    const job = await this.thumbnailQueue.getJob(jobId);
    if (!job) {
      return { status: "not_found" };
    }
    if (job.data.userId !== userId) {
      return { status: "not_found" };
    }
    const state = await job.getState();
    return {
      status: state,
      failedReason: state === "failed" ? getFriendlyError(job.failedReason || "") : undefined,
    };
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
