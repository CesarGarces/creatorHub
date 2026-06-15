import type { AIRequest, AIResponse, AIProvider, AITaskType, ProviderTier } from "@creator-hub/shared-types";

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numberOfImages?: number;
  model?: string;
}

export interface AIProviderInterface {
  readonly name: AIProvider;
  readonly supportedTasks: AITaskType[];
  readonly supportedModels: string[];
  readonly tier?: ProviderTier;

  generate(request: AIRequest): Promise<AIResponse>;
  generateImage(options: ImageGenerationOptions): Promise<AIResponse>;
  validateConfig(): boolean;
}
