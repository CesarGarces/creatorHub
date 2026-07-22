import type {
  AIRequest,
  AIResponse,
  AIProvider,
  AITaskType,
  ProviderTier,
  AIStreamChunk,
} from "@creator-hub/shared-types";

export interface ImageGenerationOptions {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numberOfImages?: number;
  model?: string;
  imageUrl?: string;
  aspectRatio?: string;
}

export interface AIProviderInterface {
  readonly name: AIProvider;
  readonly supportedTasks: AITaskType[];
  readonly supportedModels: string[];
  readonly tier?: ProviderTier;

  generate(request: AIRequest): Promise<AIResponse>;
  generateImage(options: ImageGenerationOptions): Promise<AIResponse>;
  generateVideo?(request: AIRequest): Promise<AIResponse>;
  generateStream?(request: AIRequest): AsyncGenerator<AIStreamChunk>;
  validateConfig(): boolean;
}
