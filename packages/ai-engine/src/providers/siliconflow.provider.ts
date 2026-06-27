import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class SiliconFlowProvider extends AIProviderBase {
  readonly name: AIProvider = "siliconflow";
  readonly supportedTasks: AITaskType[] = ["image-generation"];
  readonly supportedModels = ["FLUX.2-pro", "FLUX.1-Kontext-max"];
  readonly tier = "free" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
      imageUrl: request.parameters?.imageUrl as string | undefined,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const isKontext = !!options.imageUrl;
    const model = isKontext
      ? "black-forest-labs/FLUX.1-Kontext-max"
      : "black-forest-labs/FLUX.2-pro";

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      image_size: `${options.width || 1024}x${options.height || 1024}`,
    };

    if (isKontext) {
      body.input_image = options.imageUrl;
    } else if (options.negativePrompt) {
      body.negative_prompt = options.negativePrompt;
    }

    const response = await fetch(
      "https://api.siliconflow.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const images = data.images as Array<{ url: string }>;

    if (!images?.[0]?.url) {
      throw new Error("SiliconFlow returned no image URL");
    }

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model: isKontext ? "FLUX.1-Kontext-max" : "FLUX.2-pro",
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
