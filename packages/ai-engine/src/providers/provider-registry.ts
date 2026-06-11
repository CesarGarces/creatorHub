import { Injectable } from "@nestjs/common";
import type { AIProviderInterface } from "./provider.interface";
import type { AIProvider, AITaskType } from "@creator-hub/shared-types";

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

  getAllProviders(): AIProviderInterface[] {
    return Array.from(this.providers.values());
  }

  isRegistered(name: AIProvider): boolean {
    return this.providers.has(name);
  }
}
