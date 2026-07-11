import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class StabilityAIProvider extends AIProviderBase {
  readonly name: AIProvider = "stability-ai";
  readonly supportedTasks: AITaskType[] = ["image-generation", "image-editing"];
  readonly supportedModels = ["stable-diffusion-3"];

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
      aspectRatio: request.parameters?.aspectRatio as string,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const formData = new FormData();
    formData.append("prompt", options.prompt);
    if (options.negativePrompt) {
      formData.append("negative_prompt", options.negativePrompt);
    }
    formData.append("aspect_ratio", options.aspectRatio || "16:9");
    formData.append("output_format", "png");

    const response = await fetch(
      "https://api.stability.ai/v2beta/stable-image/generate/sd3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.getApiKey()}`,
          Accept: "image/*",
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stability AI error ${response.status}: ${errorText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    if (imageBuffer.byteLength === 0) {
      throw new Error("Stability AI returned empty image data");
    }
    const base64 = Buffer.from(imageBuffer).toString("base64");

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model: "stable-diffusion-3",
      output: {
        type: "image",
        url: `data:image/png;base64,${base64}`,
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: { credits: 3 },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "STABILITY_AI_API_KEY";
  }
}
