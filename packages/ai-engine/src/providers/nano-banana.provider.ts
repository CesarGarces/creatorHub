import { AIProviderBase } from "./ai-provider.base";
import type { AIRequest, AIResponse, AITaskType, AIProvider } from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class NanoBananaProvider extends AIProviderBase {
  readonly name: AIProvider = "nano-banana";
  readonly supportedTasks: AITaskType[] = ["image-generation"];
  readonly supportedModels = ["nano-banana"];

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const aspectRatio = this.getAspectRatio(options.width || 1024, options.height || 1024);

    const response = await fetch("https://nanobanana.aikit.club/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: options.prompt,
        model: "nano-banana",
        n: 1,
        aspect_ratio: aspectRatio,
        output_format: "png",
        response_format: "url",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NanoBanana API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string }>;
      url?: string;
    };

    const url = data.data?.[0]?.url || data.url;
    if (!url) {
      throw new Error("NanoBanana returned no image URL");
    }

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model: "nano-banana",
      output: {
        type: "image",
        url,
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: { credits: 1 },
      latency: 0,
    };
  }

  private getAspectRatio(width: number, height: number): string {
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.1) return "16:9";
    if (Math.abs(ratio - 9 / 16) < 0.1) return "9:16";
    if (Math.abs(ratio - 4 / 3) < 0.1) return "4:3";
    if (Math.abs(ratio - 3 / 4) < 0.1) return "3:4";
    return "1:1";
  }

  protected getApiKeyEnvVar(): string | null {
    return "NANO_BANANA_API_KEY";
  }
}
