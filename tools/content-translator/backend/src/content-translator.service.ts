import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { CreditService } from "@creator-hub/billing";
import { AIEngineService, ProviderRegistry } from "@creator-hub/ai-engine";
import { prisma } from "@creator-hub/database";
import { Logger, getFriendlyError } from "@creator-hub/shared-utils";

export interface EnqueuedTranslation {
  jobId: string;
}

@Injectable()
export class ContentTranslatorService {
  private logger = new Logger("ContentTranslatorService");

  constructor(
    private aiEngine: AIEngineService,
    private creditService: CreditService,
    private providerRegistry: ProviderRegistry,
    @InjectQueue("translation") private translationQueue: Queue,
  ) {}

  async translate(params: {
    userId: string;
    text: string;
    targetLanguage: string;
    provider?: string;
  }): Promise<EnqueuedTranslation> {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    if (!user) {
      throw new Error("User not found");
    }

    const providerSlug = this.selectProviderSlug(params.provider);
    const provider = await prisma.provider.findUnique({
      where: { slug: providerSlug },
    });
    if (!provider) {
      throw new Error("Selected provider is not available");
    }

    if (user.plan === "FREE" && provider.tier === "PRO") {
      throw new Error(
        "This provider is only available on paid plans. Please upgrade.",
      );
    }

    const creditCost = provider.costPerCredit;
    const totalCredits = user.currentCredits;
    if (totalCredits < creditCost) {
      throw new Error(
        "No credits available. Please upgrade your plan or purchase credits.",
      );
    }

    const selectedProvider = this.selectProviderName(user, provider.slug);

    const job = await this.translationQueue.add("translate", {
      userId: params.userId,
      text: params.text,
      targetLanguage: params.targetLanguage,
      provider: selectedProvider,
      providerId: provider.id,
      providerTier: provider.tier,
      creditCost,
    });

    this.logger.info("Translation job enqueued", {
      jobId: job.id,
      userId: params.userId,
      targetLanguage: params.targetLanguage,
    });

    return { jobId: job.id! };
  }

  async getJobStatus(
    jobId: string,
    userId: string,
  ): Promise<{ status: string; failedReason?: string }> {
    const job = await this.translationQueue.getJob(jobId);
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

  async getUserTranslations(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: unknown[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const skip = (page - 1) * limit;
    const [translations, total] = await Promise.all([
      prisma.aIRequestLog.findMany({
        where: { userId, toolId: "content-translator", success: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aIRequestLog.count({
        where: { userId, toolId: "content-translator", success: true },
      }),
    ]);

    return {
      data: translations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private selectProviderSlug(requestedProvider?: string): string {
    if (requestedProvider) {
      return requestedProvider;
    }
    return "deepseek-v4";
  }

  private selectProviderName(user: any, slug: string): string {
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
