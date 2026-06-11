import type { AIProviderInterface, ImageGenerationOptions } from "./provider.interface";
import type { AIRequest, AIResponse, AIProvider, AITaskType } from "@creator-hub/shared-types";

export abstract class AIProviderBase implements AIProviderInterface {
  abstract readonly name: AIProvider;
  abstract readonly supportedTasks: AITaskType[];
  abstract readonly supportedModels: string[];

  abstract generate(request: AIRequest): Promise<AIResponse>;
  abstract generateImage(options: ImageGenerationOptions): Promise<AIResponse>;

  validateConfig(): boolean {
    const envVar = this.getApiKeyEnvVar();
    return envVar ? !!process.env[envVar] : true;
  }

  protected abstract getApiKeyEnvVar(): string | null;

  protected getApiKey(): string {
    const envVar = this.getApiKeyEnvVar();
    const key = envVar ? process.env[envVar] : undefined;
    if (!key) {
      throw new Error(`API key not configured for ${this.name}`);
    }
    return key;
  }
}
