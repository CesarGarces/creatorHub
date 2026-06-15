import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class MockImageProvider extends AIProviderBase {
  readonly name: AIProvider = "mock";
  readonly supportedTasks: AITaskType[] = ["image-generation"];
  readonly supportedModels = ["mock-model"];
  readonly tier = "free" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    console.log(
      `[MOCK] Generando imagen para: "${options.prompt?.slice(0, 50)}..."`,
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model: "mock-model",
      output: {
        type: "image",
        url: `https://via.placeholder.com/${options.width || 1024}x${options.height || 1024}.png?text=Mock+Thumbnail`,
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: { credits: 1 },
      latency: 500,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return null;
  }
}
