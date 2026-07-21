import { Injectable } from "@nestjs/common";
import type { AIProviderInterface } from "./provider.interface";
import type {
  AIProvider,
  AITaskType,
  AIRequest,
  AIStreamChunk,
} from "@creator-hub/shared-types";

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

  getStreamingProviderForModel(model: string): AIProviderInterface | undefined {
    return this.getStreamingProviders().find((p) =>
      p.supportedModels.includes(model),
    );
  }

  getProviderForModel(model: string): AIProviderInterface | undefined {
    return Array.from(this.providers.values()).find((p) =>
      p.supportedModels.includes(model),
    );
  }
}
