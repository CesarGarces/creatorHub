import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { Prisma } from "@creator-hub/database";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import type { ModelInfo } from "../gateways/ai-gateway.interface";
import { OpenRouterModelsService } from "./openrouter-models.service";
import { SiliconFlowGateway } from "../gateways/siliconflow.gateway";

/**
 * ModelRegistryService - Centralized model management in database.
 *
 * This service:
 * - Stores model metadata in ModelMetadata table
 * - Syncs with OpenRouter API + SiliconFlow API (hourly)
 * - Provides CRUD operations for admin
 * - Tracks model usage and costs
 */
@Injectable()
export class ModelRegistryService {
  private logger = new Logger("ModelRegistryService");

  constructor(
    private openRouterModelsService: OpenRouterModelsService,
    private siliconFlowGateway: SiliconFlowGateway,
  ) {}

  // ──────────────────────────────────────────────
  // SYNC OPERATIONS
  // ──────────────────────────────────────────────

  /**
   * Pricing thresholds for credit cost calculation.
   * Based on USD per 1K tokens (prompt) or per image generation.
   */
  private static readonly CREDIT_THRESHOLDS = {
    TEXT: {
      VERY_CHEAP: 0.0000005, // < $0.0000005/1K tokens → 1 credit
      CHEAP: 0.000005, // < $0.000005/1K tokens → 3 credits
      MEDIUM: 0.00005, // < $0.00005/1K tokens → 5 credits
      // >= $0.00005/1K tokens → 10 credits
    },
    IMAGE: {
      CHEAP: 0.01, // < $0.01/image → 5 credits
      MEDIUM: 0.05, // < $0.05/image → 10 credits
      // >= $0.05/image → 15 credits
    },
    VIDEO: 30, // All video models → 30 credits
    SPEECH_TO_TEXT: 2, // STT → 2 credits
    DEFAULT: 5, // Fallback → 5 credits
  } as const;

  /**
   * Sync models from OpenRouter + SiliconFlow to database
   */
  async syncModels(): Promise<{
    total: number;
    created: number;
    updated: number;
    deactivated: number;
  }> {
    this.logger.info("Starting model sync from OpenRouter + SiliconFlow");
    Sentry.addBreadcrumb({
      category: "ai.sync",
      message: "Starting model sync from OpenRouter + SiliconFlow",
      level: "info",
    });

    const results = { total: 0, created: 0, updated: 0, deactivated: 0 };

    // Sync OpenRouter models
    const openRouterModels = await this.openRouterModelsService.fetchModels();
    const orResult = await this.syncProvider("openrouter", openRouterModels);
    results.total += orResult.total;
    results.created += orResult.created;
    results.updated += orResult.updated;
    results.deactivated += orResult.deactivated;

    // Sync SiliconFlow models
    const siliconFlowModels = await this.siliconFlowGateway.listModels();
    const sfResult = await this.syncProvider("siliconflow", siliconFlowModels);
    results.total += sfResult.total;
    results.created += sfResult.created;
    results.updated += sfResult.updated;
    results.deactivated += sfResult.deactivated;

    this.logger.info("Model sync completed", results);
    Sentry.addBreadcrumb({
      category: "ai.sync",
      message: `Model sync completed: ${results.created} created, ${results.updated} updated, ${results.deactivated} deactivated`,
      level: "info",
      data: results,
    });

    return results;
  }

  /**
   * Sync models from a single provider
   */
  private async syncProvider(
    providerSlug: string,
    remoteModels: ModelInfo[],
  ): Promise<{
    total: number;
    created: number;
    updated: number;
    deactivated: number;
  }> {
    const results = {
      total: remoteModels.length,
      created: 0,
      updated: 0,
      deactivated: 0,
    };

    // Get existing models for this provider
    const existingModels = await prisma.modelMetadata.findMany({
      where: { providerSlug },
    });

    const existingMap = new Map(existingModels.map((m) => [m.modelId, m]));

    // Separate models into updates and creates
    const toCreate: ModelInfo[] = [];
    const toUpdate: {
      remote: ModelInfo;
      existing: (typeof existingModels)[0];
    }[] = [];

    for (const model of remoteModels) {
      const existing = existingMap.get(model.id);
      if (existing) {
        toUpdate.push({ remote: model, existing });
      } else {
        toCreate.push(model);
      }
    }

    // Batch create new models
    if (toCreate.length > 0) {
      const createData = toCreate.map((model) => ({
        providerSlug,
        modelId: model.id,
        displayName: model.name,
        taskType: model.taskType,
        tier: "PRO" as const,
        contextLength: model.contextLength,
        maxOutputTokens: model.maxOutputTokens,
        supportsStreaming: model.supportsStreaming,
        supportsVision: model.supportsVision,
        promptPricePer1k: model.pricing.promptPer1k,
        completionPricePer1k: model.pricing.completionPer1k,
        imagePricePerGen: model.pricing.imagePerGen,
        description: model.description,
        tags: model.tags || [],
        isActive: false, // New models are inactive by default
        creditCost: this.calculateDefaultCreditCost(model),
        profitMargin: 2.0,
        lastSyncedAt: new Date(),
      }));

      // Use createMany with skipDuplicates for safety
      const batchResult = await prisma.modelMetadata.createMany({
        data: createData,
        skipDuplicates: true,
      });
      results.created = batchResult.count;
    }

    // Batch update existing models using transaction
    if (toUpdate.length > 0) {
      await prisma.$transaction(
        toUpdate.map(({ remote, existing }) =>
          prisma.modelMetadata.update({
            where: {
              providerSlug_modelId: { providerSlug, modelId: remote.id },
            },
            data: {
              displayName: remote.name,
              // Only update taskType if the model doesn't already have a non-default one
              ...(existing.taskType === "text-generation" &&
              remote.taskType !== "text-generation"
                ? { taskType: remote.taskType }
                : {}),
              contextLength: remote.contextLength,
              maxOutputTokens: remote.maxOutputTokens,
              supportsStreaming: remote.supportsStreaming,
              supportsVision: remote.supportsVision,
              promptPricePer1k: remote.pricing.promptPer1k,
              completionPricePer1k: remote.pricing.completionPer1k,
              imagePricePerGen: remote.pricing.imagePerGen,
              description: remote.description,
              tags: remote.tags || [],
              lastSyncedAt: new Date(),
            },
          }),
        ),
      );
      results.updated = toUpdate.length;
    }

    // Mark models not in remote list as stale
    const remoteIds = new Set(remoteModels.map((m) => m.id));
    const staleModels = existingModels.filter((m) => !remoteIds.has(m.modelId));
    if (staleModels.length > 0) {
      await prisma.$transaction(
        staleModels.map((existing) =>
          prisma.modelMetadata.update({
            where: { id: existing.id },
            data: { isActive: false },
          }),
        ),
      );
      results.deactivated = staleModels.length;
    }

    this.logger.info(`Sync completed for ${providerSlug}`, results);
    return results;
  }

  /**
   * Calculate default credit cost based on pricing
   */
  private calculateDefaultCreditCost(model: ModelInfo): number {
    const promptPrice = model.pricing.promptPer1k || 0;
    const imagePrice = model.pricing.imagePerGen || 0;
    const T = ModelRegistryService.CREDIT_THRESHOLDS;

    switch (model.taskType) {
      case "text-generation":
        if (promptPrice < T.TEXT.VERY_CHEAP) return 1;
        if (promptPrice < T.TEXT.CHEAP) return 3;
        if (promptPrice < T.TEXT.MEDIUM) return 5;
        return 10;

      case "image-generation":
        if (imagePrice < T.IMAGE.CHEAP) return 5;
        if (imagePrice < T.IMAGE.MEDIUM) return 10;
        return 15;

      case "video-generation":
        return T.VIDEO;

      case "speech-to-text":
        return T.SPEECH_TO_TEXT;

      default:
        return T.DEFAULT;
    }
  }

  // ──────────────────────────────────────────────
  // CRUD OPERATIONS
  // ──────────────────────────────────────────────

  /**
   * Get all models with filtering
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    providerSlug?: string;
    taskType?: string;
    tier?: string;
    isActive?: boolean;
    search?: string;
    tags?: string[];
  }): Promise<{
    data: any[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ModelMetadataWhereInput = {};

    if (params.providerSlug) {
      where.providerSlug = params.providerSlug;
    }

    if (params.taskType) {
      where.taskType = params.taskType;
    }

    if (params.tier) {
      where.tier = params.tier as any;
    }

    if (typeof params.isActive === "boolean") {
      where.isActive = params.isActive;
    }

    if (params.search) {
      where.OR = [
        { displayName: { contains: params.search, mode: "insensitive" } },
        { modelId: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params.tags && params.tags.length > 0) {
      where.tags = { hasSome: params.tags };
    }

    const [data, total] = await Promise.all([
      prisma.modelMetadata.findMany({
        where,
        orderBy: [{ tier: "asc" }, { taskType: "asc" }, { displayName: "asc" }],
        skip,
        take: limit,
      }),
      prisma.modelMetadata.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get model by ID
   */
  async findById(id: string): Promise<any> {
    const model = await prisma.modelMetadata.findUnique({ where: { id } });
    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }
    return model;
  }

  /**
   * Get model by provider slug and model ID
   */
  async findByProviderAndModel(
    providerSlug: string,
    modelId: string,
  ): Promise<any> {
    const model = await prisma.modelMetadata.findUnique({
      where: { providerSlug_modelId: { providerSlug, modelId } },
    });
    if (!model) {
      throw new Error(`Model not found: ${providerSlug}/${modelId}`);
    }
    return model;
  }

  /**
   * Update model configuration
   */
  async updateConfig(
    id: string,
    config: {
      isActive?: boolean;
      creditCost?: number;
      profitMargin?: number;
    },
  ): Promise<any> {
    const model = await prisma.modelMetadata.findUnique({ where: { id } });
    if (!model) {
      throw new Error(`Model not found: ${id}`);
    }

    return prisma.modelMetadata.update({
      where: { id },
      data: {
        ...config,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Bulk update models
   */
  async bulkUpdate(
    ids: string[],
    config: {
      isActive?: boolean;
      creditCost?: number;
      profitMargin?: number;
    },
  ): Promise<{ updated: number }> {
    const result = await prisma.modelMetadata.updateMany({
      where: { id: { in: ids } },
      data: {
        ...config,
        updatedAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  /**
   * Get active models for a task type
   */
  async getActiveModels(taskType: string): Promise<any[]> {
    return prisma.modelMetadata.findMany({
      where: {
        taskType,
        isActive: true,
      },
      orderBy: [{ creditCost: "asc" }, { displayName: "asc" }],
    });
  }

  /**
   * Get model statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    byProvider: Record<string, number>;
    byTaskType: Record<string, number>;
    byTier: Record<string, number>;
  }> {
    const [total, active, byProvider, byTaskType, byTier] = await Promise.all([
      prisma.modelMetadata.count(),
      prisma.modelMetadata.count({ where: { isActive: true } }),
      prisma.modelMetadata.groupBy({
        by: ["providerSlug"],
        _count: true,
      }),
      prisma.modelMetadata.groupBy({
        by: ["taskType"],
        _count: true,
      }),
      prisma.modelMetadata.groupBy({
        by: ["tier"],
        _count: true,
      }),
    ]);

    return {
      total,
      active,
      byProvider: Object.fromEntries(
        byProvider.map((p) => [p.providerSlug, p._count]),
      ),
      byTaskType: Object.fromEntries(
        byTaskType.map((t) => [t.taskType, t._count]),
      ),
      byTier: Object.fromEntries(byTier.map((t) => [t.tier, t._count])),
    };
  }

  // ──────────────────────────────────────────────
  // USAGE TRACKING
  // ──────────────────────────────────────────────

  /**
   * Record model usage
   */
  async recordUsage(
    providerSlug: string,
    modelId: string,
    usage: {
      tokens?: number;
      images?: number;
      costUsd?: number;
      creditsCharged?: number;
    },
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.providerUsage.upsert({
      where: {
        providerSlug_modelId_date: {
          providerSlug,
          modelId,
          date: today,
        },
      },
      create: {
        providerSlug,
        modelId,
        date: today,
        totalRequests: 1,
        totalTokens: usage.tokens || 0,
        totalImages: usage.images || 0,
        actualCostUsd: usage.costUsd || 0,
        creditsCharged: usage.creditsCharged || 0,
      },
      update: {
        totalRequests: { increment: 1 },
        totalTokens: { increment: usage.tokens || 0 },
        totalImages: { increment: usage.images || 0 },
        actualCostUsd: { increment: usage.costUsd || 0 },
        creditsCharged: { increment: usage.creditsCharged || 0 },
      },
    });
  }

  /**
   * Get usage stats for a date range
   */
  async getUsageStats(params: {
    startDate: Date;
    endDate: Date;
    providerSlug?: string;
    modelId?: string;
  }): Promise<any[]> {
    const where: Prisma.ProviderUsageWhereInput = {
      date: {
        gte: params.startDate,
        lte: params.endDate,
      },
    };

    if (params.providerSlug) {
      where.providerSlug = params.providerSlug;
    }

    if (params.modelId) {
      where.modelId = params.modelId;
    }

    return prisma.providerUsage.findMany({
      where,
      orderBy: { date: "desc" },
    });
  }
}
