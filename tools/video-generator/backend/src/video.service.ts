import { Injectable } from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { AIEngineService, ProviderRegistry } from "@creator-hub/ai-engine";
import { prisma } from "@creator-hub/database";
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
  }): Promise<EnqueuedVideo> {
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });
    if (!user) throw new Error("User not found");

    const providerSlug = params.provider || "siliconflow-video";
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
    });

    const creditCost = provider?.costPerCredit || 50;
    if (user.currentCredits < creditCost) {
      throw new Error(
        "Insufficient credits. Video generation requires 50 credits.",
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
    });

    this.logger.info(`Video job enqueued`, {
      jobId: job.id,
      userId: params.userId,
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
