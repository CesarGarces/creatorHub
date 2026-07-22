import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { AIEngineService, ProviderRegistry } from "@creator-hub/ai-engine";
import { prisma, resolveProviderSlug } from "@creator-hub/database";
import { Logger, getFriendlyError } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { MarketingEventService } from "./use-cases/marketing-event.service";

export interface EnqueuedVideo {
  jobId: string;
}

@Injectable()
export class VideoService {
  private logger = new Logger("VideoService");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private storageService: StorageService,
    private marketingEventService: MarketingEventService,
    private providerRegistry: ProviderRegistry,
    @InjectQueue("video-generation") private videoQueue: Queue,
  ) {}

  async generate(params: {
    userId: string;
    prompt: string;
    imageUrl?: string;
    model?: string;
    provider?: string;
    aspectRatio?: string;
    duration?: number;
    audioEnabled?: boolean;
    quality?: string;
  }): Promise<EnqueuedVideo> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });
    if (!user) throw new NotFoundException("User not found");

    const model = params.model || "Wan-AI/Wan2.2-T2V-A14B";
    if (model.includes("I2V") && !params.imageUrl) {
      throw new BadRequestException(
        "Image-to-Video model requires a source image",
      );
    }

    const providerSlug = await resolveProviderSlug(
      params.provider || "siliconflow-video",
    );
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
    });
    if (!provider) {
      throw new NotFoundException(
        `Provider "${providerSlug}" not found in database. Please run the seed script.`,
      );
    }
    if (!provider.isActive) {
      throw new NotFoundException(
        `Provider "${providerSlug}" is currently inactive. Please contact support.`,
      );
    }

    // Verify the specific model is active
    const modelId = params.model || "Wan-AI/Wan2.2-T2V-A14B";
    const modelMetadataCheck = await prisma.modelMetadata.findUnique({
      where: {
        providerSlug_modelId: { providerSlug, modelId },
      },
      select: { isActive: true, displayName: true, creditCost: true },
    });
    if (modelMetadataCheck && !modelMetadataCheck.isActive) {
      throw new BadRequestException(
        `Model "${modelMetadataCheck.displayName}" is currently inactive. Please select a different model.`,
      );
    }

    // Determine if model supports advanced settings (Seedance models)
    const isSeedance = model.toLowerCase().includes("seedance");
    const supportsAdvancedSettings = isSeedance;

    // Validate and normalize duration (4-15 seconds for Seedance)
    const duration = supportsAdvancedSettings
      ? Math.min(Math.max(params.duration || 4, 4), 15)
      : undefined;

    // Calculate credits: base cost per second × duration
    const modelMetadata = await prisma.modelMetadata.findUnique({
      where: {
        providerSlug_modelId: { providerSlug, modelId },
      },
      select: { creditCost: true },
    });
    const baseCostPerSecond =
      modelMetadata?.creditCost || provider.costPerCredit;
    const creditCost = duration
      ? baseCostPerSecond * duration
      : baseCostPerSecond;

    if (user.currentCredits < creditCost) {
      throw new BadRequestException(
        `Insufficient credits. Need ${creditCost} credits (${baseCostPerSecond}/sec × ${duration || 1}s), but you have ${user.currentCredits}.`,
      );
    }

    const dimensions = this.resolveAspectRatio(params.aspectRatio);

    const job = await this.videoQueue.add("generate", {
      userId: params.userId,
      prompt: params.prompt,
      imageUrl: params.imageUrl,
      model: params.model || "Wan-AI/Wan2.2-T2V-A14B",
      provider: providerSlug,
      providerId: provider?.id,
      providerTier: provider?.tier || "FREE",
      creditCost,
      width: dimensions.width,
      height: dimensions.height,
      duration: supportsAdvancedSettings ? duration : undefined,
      audioEnabled: supportsAdvancedSettings ? params.audioEnabled : undefined,
      quality: supportsAdvancedSettings ? params.quality : undefined,
    });

    this.logger.info(`Video job enqueued`, {
      jobId: job.id,
      userId: params.userId,
      creditCost,
      duration,
    });
    return { jobId: job.id! };
  }

  async getJobStatus(
    jobId: string,
    userId: string,
  ): Promise<{ status: string; failedReason?: string }> {
    const job = await this.videoQueue.getJob(jobId);
    if (!job) return { status: "not_found" };
    if (job.data.userId !== userId) return { status: "not_found" };
    const state = await job.getState();
    return {
      status: state,
      failedReason:
        state === "failed"
          ? getFriendlyError(job.failedReason || "")
          : undefined,
    };
  }

  async getUserVideos(userId: string, page = 1, limit = 20): Promise<any> {
    const skip = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      prisma.generatedImage.findMany({
        where: { userId, toolId: "video-generator", type: "VIDEO" },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.generatedImage.count({
        where: { userId, toolId: "video-generator", type: "VIDEO" },
      }),
    ]);

    const videosWithUrls = await Promise.all(
      videos.map(async (vid) => {
        let url = vid.url || "";
        if (vid.url && !vid.url.startsWith("http")) {
          const parts = vid.url.split("/");
          const bucket = parts[0] || "";
          const key = parts.slice(1).join("/");
          if (bucket && key) {
            try {
              url = await this.storageService.getPresignedDownloadUrl(
                bucket,
                key,
                3600,
              );
            } catch {
              url = vid.url;
            }
          }
        }
        return { ...vid, url };
      }),
    );

    return {
      data: videosWithUrls,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private resolveAspectRatio(aspectRatio?: string): {
    width: number;
    height: number;
  } {
    switch (aspectRatio) {
      case "9:16":
        return { width: 720, height: 1280 };
      case "1:1":
        return { width: 720, height: 720 };
      case "16:9":
      default:
        return { width: 1280, height: 720 };
    }
  }
}
