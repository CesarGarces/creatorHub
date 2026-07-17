import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { CreditService } from "@creator-hub/billing";
import { StorageService } from "@creator-hub/storage";
import { AIEngineService, ProviderRegistry } from "@creator-hub/ai-engine";
import { prisma, resolveProviderSlug } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { getFriendlyError } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { MarketingEventService } from "./use-cases/marketing-event.service";

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
    private marketingEventService: MarketingEventService,
    private providerRegistry: ProviderRegistry,
    @InjectQueue("thumbnail-generation") private thumbnailQueue: Queue,
  ) {}

  async generate(params: {
    userId: string;
    prompt: string;
    negativePrompt?: string;
    style?: string;
    provider?: string;
    width?: number;
    height?: number;
    aspectRatio?: string;
    imageUrl?: string;
  }): Promise<EnqueuedThumbnail> {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const providerSlug = await this.selectProviderSlug(params.provider);

    console.log("[ThumbnailService] selectProviderSlug result:", {
      paramsProvider: params.provider,
      resolvedSlug: providerSlug,
    });

    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
    });

    console.log("[ThumbnailService] Provider lookup result:", {
      providerSlug,
      providerExists: !!provider,
      providerIsActive: provider?.isActive,
    });

    if (!provider) {
      throw new NotFoundException("Selected provider is not available");
    }
    if (!provider.isActive) {
      throw new NotFoundException("Selected provider is not available");
    }

    // Verify the specific model is active (if a modelId was provided)
    if (params.provider) {
      const modelMetadata = await prisma.modelMetadata.findUnique({
        where: {
          providerSlug_modelId: { providerSlug, modelId: params.provider },
        },
        select: { isActive: true, displayName: true },
      });
      if (modelMetadata && !modelMetadata.isActive) {
        throw new BadRequestException(
          `Model "${modelMetadata.displayName}" is currently inactive. Please select a different model.`,
        );
      }
    }

    // Free tier users cannot use paid providers
    if (user.plan === "FREE" && provider.tier === "PRO") {
      throw new ForbiddenException(
        "This provider is only available on paid plans. Please upgrade.",
      );
    }

    const creditCost = provider.costPerCredit;
    const totalCredits = user.currentCredits;
    if (totalCredits < creditCost) {
      throw new BadRequestException(
        "No credits available. Please upgrade your plan or purchase credits.",
      );
    }

    const selectedProvider = this.selectProviderName(user, provider.slug);

    console.log("[ThumbnailService] Enqueuing job with:", {
      paramsProvider: params.provider,
      selectedProvider,
      providerSlug,
    });

    const job = await this.thumbnailQueue.add("generate", {
      userId: params.userId,
      prompt: params.prompt,
      negativePrompt: params.negativePrompt,
      style: params.style,
      provider: selectedProvider,
      providerId: provider.id,
      providerTier: provider.tier,
      model: params.provider, // Pass the original modelId (e.g. "black-forest-labs/FLUX.2-pro")
      creditCost,
      width: params.width || 1280,
      height: params.height || 720,
      aspectRatio: params.aspectRatio,
      imageUrl: params.imageUrl,
    });

    this.logger.info(`Thumbnail job enqueued`, {
      jobId: job.id,
      userId: params.userId,
    });

    return { jobId: job.id! };
  }

  async getJobStatus(
    jobId: string,
    userId: string,
  ): Promise<{ status: string; failedReason?: string }> {
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
      failedReason:
        state === "failed"
          ? getFriendlyError(job.failedReason || "")
          : undefined,
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

    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        let url = img.url || "";
        if (img.url && !img.url.startsWith("http")) {
          const parts = img.url.split("/");
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
              url = img.url;
            }
          }
        }
        return { ...img, url };
      }),
    );

    return {
      data: imagesWithUrls,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private async selectProviderSlug(
    requestedProvider?: string,
  ): Promise<string> {
    if (requestedProvider) {
      return resolveProviderSlug(requestedProvider);
    }

    // Default to first active free provider if none requested
    return "z-image-turbo";
  }

  private selectProviderName(user: any, slug: string): string {
    // If the requested provider is not registered at runtime, fall back to a
    // registered provider respecting the user's plan.
    if (this.providerRegistry.isRegistered(slug as any)) {
      return slug;
    }

    if (user.plan === "FREE") {
      const freeProviders = this.providerRegistry.getFreeProviders();
      const firstFree = freeProviders[0];
      if (firstFree) {
        return firstFree.name;
      }
    }

    const allProviders = this.providerRegistry.getAllProviders();
    const first = allProviders[0];
    if (first) {
      return first.name;
    }

    return slug;
  }
}
