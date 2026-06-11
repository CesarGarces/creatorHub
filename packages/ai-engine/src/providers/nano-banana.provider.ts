import { AIProviderBase } from "./ai-provider.base";
import type { AIRequest, AIResponse, AITaskType, AIProvider } from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class NanoBananaProvider extends AIProviderBase {
  readonly name: AIProvider = "nano-banana";
  readonly supportedTasks: AITaskType[] = ["image-generation", "text-generation"];
  readonly supportedModels = ["nano-banana-default"];

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const response = await fetch("https://api.nanobanana.ai/v1/generate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        width: options.width || 1024,
        height: options.height || 1024,
      }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    return {
      id: (data.id as string) || crypto.randomUUID(),
      provider: this.name,
      model: "nano-banana-default",
      output: {
        type: "image",
        url: (data.url as string) || (data.image_url as string) || "",
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: { credits: 1 },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "NANO_BANANA_API_KEY";
  }
}
