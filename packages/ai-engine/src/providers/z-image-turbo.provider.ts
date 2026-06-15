import { AIProviderBase } from "./ai-provider.base";
import type { AIRequest, AIResponse, AITaskType, AIProvider } from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class ZImageTurboProvider extends AIProviderBase {
  readonly name: AIProvider = "z-image-turbo";
  readonly supportedTasks: AITaskType[] = ["image-generation"];
  readonly supportedModels = ["Z-Image-Turbo"];
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
    const image_size = `${options.width || 1024}x${options.height || 1024}`;
    const response = await fetch("https://api.siliconflow.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Tongyi-MAI/Z-Image-Turbo",
        prompt: options.prompt,
        negative_prompt: options.negativePrompt,
        image_size,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const images = data.images as Array<{ url: string }>;

    if (!images?.[0]?.url) {
      throw new Error("Z-Image-Turbo returned no image URL");
    }

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model: "Z-Image-Turbo",
      output: {
        type: "image",
        url: images[0].url,
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: { credits: 1 },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "SILICONFLOW_API_KEY";
  }
}
