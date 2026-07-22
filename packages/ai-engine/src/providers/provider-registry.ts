import { Injectable } from "@nestjs/common";
import type { AIProviderInterface } from "./provider.interface";
import type {
  AIProvider,
  AITaskType,
  AIRequest,
  AIStreamChunk,
} from "@creator-hub/shared-types";
import { prisma } from "@creator-hub/database";

@Injectable()
export class ProviderRegistry {
  private providers = new Map<AIProvider, AIProviderInterface>();

  register(provider: AIProviderInterface): void {
    this.providers.set(provider.name, provider);
  }

  unregister(name: AIProvider): void {
    this.providers.delete(name);
  }

  getProvider(name: AIProvider): AIProviderInterface {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`AI provider not registered: ${name}`);
    }
    return provider;
  }

  getProvidersByTask(taskType: AITaskType): AIProviderInterface[] {
    return Array.from(this.providers.values())
      .filter((p) => p.supportedTasks.includes(taskType))
      .sort((a, b) => {
        const aIdx = a.supportedTasks.indexOf(taskType);
        const bIdx = b.supportedTasks.indexOf(taskType);
        return aIdx - bIdx;
      });
  }

  getFreeProviders(): AIProviderInterface[] {
    return Array.from(this.providers.values()).filter((p) => p.tier === "free");
  }

  getProProviders(): AIProviderInterface[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.tier === "pro" || !p.tier,
    );
  }

  getProviderForUser(user: {
    plan: string;
    currentCredits: number;
  }): AIProviderInterface {
    if (user.plan === "FREE" && user.currentCredits > 0) {
      const freeProviders = this.getFreeProviders();
      const freeProvider = freeProviders[0];
      if (freeProvider) {
        return freeProvider;
      }
    }

    if (
      user.currentCredits > 0 ||
      user.plan === "STARTER" ||
      user.plan === "PRO" ||
      user.plan === "PAY_AS_YOU_GO"
    ) {
      const proProviders = this.getProProviders();
      const proProvider = proProviders[0];
      if (proProvider) {
        return proProvider;
      }
    }

    throw new Error(
      "No credits available. Please upgrade your plan or purchase credits.",
    );
  }

  getAllProviders(): AIProviderInterface[] {
    return Array.from(this.providers.values());
  }

  isRegistered(name: AIProvider): boolean {
    return this.providers.has(name);
  }

  getStreamingProviders(): AIProviderInterface[] {
    return Array.from(this.providers.values()).filter(
      (p) => typeof p.generateStream === "function",
    );
  }

  /**
   * Resolve which registered provider handles a given model.
   * Source of truth: ModelMetadata table in DB (synced from OpenRouter + SiliconFlow APIs).
   * Falls back to hardcoded supportedModels if DB lookup fails.
   */
  async getProviderForModel(
    model: string,
  ): Promise<AIProviderInterface | undefined> {
    // 1. Query DB: find active ModelMetadata record for this modelId
    const modelMeta = await prisma.modelMetadata.findFirst({
      where: { modelId: model, isActive: true },
    });

    if (modelMeta) {
      const provider = this.providers.get(modelMeta.providerSlug as AIProvider);
      if (provider) return provider;
    }

    // 2. Fallback: check hardcoded supportedModels (legacy providers)
    return Array.from(this.providers.values()).find((p) =>
      p.supportedModels.includes(model),
    );
  }

  /**
   * Resolve which registered streaming-capable provider handles a given model.
   * Source of truth: ModelMetadata table (supportsStreaming field).
   * Falls back to hardcoded supportedModels if DB lookup fails.
   */
  async getStreamingProviderForModel(
    model: string,
  ): Promise<AIProviderInterface | undefined> {
    // 1. Query DB: find active model that supports streaming
    const modelMeta = await prisma.modelMetadata.findFirst({
      where: { modelId: model, isActive: true, supportsStreaming: true },
    });

    if (modelMeta) {
      const provider = this.providers.get(modelMeta.providerSlug as AIProvider);
      if (provider && typeof provider.generateStream === "function") {
        return provider;
      }
    }

    // 2. Fallback: check hardcoded supportedModels (legacy providers)
    return this.getStreamingProviders().find((p) =>
      p.supportedModels.includes(model),
    );
  }

  /**
   * Returns any provider that supports the given task type.
   * Used as fallback when model-specific lookup fails.
   */
  getAnyProviderForTask(taskType: AITaskType): AIProviderInterface | undefined {
    return this.getProvidersByTask(taskType)[0];
  }
}
