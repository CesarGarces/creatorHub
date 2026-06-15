import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class FluxProvider extends AIProviderBase {
  readonly name: AIProvider = "flux";
  readonly supportedTasks: AITaskType[] = ["image-generation"];
  readonly supportedModels = ["flux-dev", "flux-pro"];

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const response = await fetch("https://api.bfl.ml/v1/image", {
      method: "POST",
      headers: {
        "x-key": this.getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: options.prompt,
        width: options.width || 1024,
        height: options.height || 1024,
        steps: 28,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Flux API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const url = (data.result as string) || (data.url as string);
    if (!url) {
      throw new Error("Flux returned no image URL");
    }

    return {
      id: (data.id as string) || crypto.randomUUID(),
      provider: this.name,
      model: "flux-dev",
      output: {
        type: "image",
        url,
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: { credits: 2 },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "FLUX_API_KEY";
  }
}
