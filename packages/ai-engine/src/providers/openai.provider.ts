import OpenAI from "openai";
import { AIProviderBase } from "./ai-provider.base";
import type { AIRequest, AIResponse, AITaskType, AIProvider } from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

type OpenAIImageModel = "gpt-image-1" | "dall-e-2" | "dall-e-3";

const OPENAI_IMAGE_MODELS: OpenAIImageModel[] = ["gpt-image-1", "dall-e-2", "dall-e-3"];

export class OpenAIImageProvider extends AIProviderBase {
  readonly name: AIProvider = "openai";
  readonly supportedTasks: AITaskType[] = [
    "image-generation",
    "image-editing",
    "image-variation",
    "text-generation",
    "text-analysis",
  ];
  readonly supportedModels = ["gpt-image-1", "dall-e-2", "dall-e-3", "gpt-4o", "gpt-4o-mini"];

  private client: OpenAI;

  constructor() {
    super();
    this.client = new OpenAI({ apiKey: this.getApiKey() });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (request.taskType === "image-generation") {
      return this.generateImage({
        prompt: request.prompt,
        negativePrompt: request.negativePrompt,
        width: (request.parameters?.width as number) || 1024,
        height: (request.parameters?.height as number) || 1024,
        model: request.model,
      });
    }

    const completion = await this.client.chat.completions.create({
      model: request.model || "gpt-4o-mini",
      messages: [{ role: "user", content: request.prompt }],
    });

    return {
      id: completion.id,
      provider: this.name,
      model: request.model || "gpt-4o-mini",
      output: { type: "text", content: completion.choices[0]?.message?.content || "" },
      usage: { credits: 1, tokens: completion.usage?.total_tokens },
      latency: 0,
    };
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const model = this.resolveImageModel(options.model);

    try {
      const size = this.getSizeForModel(model, options.width, options.height);
      const response = await this.client.images.generate({
        model,
        prompt: options.prompt,
        n: options.numberOfImages || 1,
        size: size as any,
        ...(model === "dall-e-3" ? { response_format: "url" } : {}),
      });

      const image = response.data?.[0];
      if (!image?.url && !image?.b64_json) {
        throw new Error("OpenAI returned no image data. The API key may be invalid or expired.");
      }

      const url = image.url || `data:image/png;base64,${image.b64_json}`;

      return {
        id: response.created.toString(),
        provider: this.name,
        model,
        output: {
          type: "image",
          url,
          width: options.width || 1024,
          height: options.height || 1024,
        } as const,
        usage: { credits: this.getCreditsForModel(model) },
        latency: 0,
      };
    } catch (error) {
      throw this.handleOpenAIError(error);
    }
  }

  private resolveImageModel(model?: string): OpenAIImageModel {
    if (model && OPENAI_IMAGE_MODELS.includes(model as OpenAIImageModel)) {
      return model as OpenAIImageModel;
    }
    return "gpt-image-1";
  }

  private getSizeForModel(model: OpenAIImageModel, width?: number, height?: number): string {
    const w = width || 1024;
    const h = height || 1024;

    if (model === "dall-e-2") {
      if (w <= 256 && h <= 256) return "256x256";
      if (w <= 512 && h <= 512) return "512x512";
      return "1024x1024";
    }

    if (model === "dall-e-3") {
      if (w > h) return "1792x1024";
      if (h > w) return "1024x1792";
      return "1024x1024";
    }

    return "1024x1024";
  }

  private getCreditsForModel(model: OpenAIImageModel): number {
    switch (model) {
      case "dall-e-2":
        return 1;
      case "dall-e-3":
        return 2;
      case "gpt-image-1":
      default:
        return 1;
    }
  }

  private handleOpenAIError(error: unknown): Error {
    if (error instanceof OpenAI.APIError) {
      const status = error.status;
      const message = error.message || "Unknown OpenAI error";

      if (status === 400 && message.toLowerCase().includes("billing")) {
        return new Error(
          "OpenAI billing limit reached. Please check your OpenAI account billing settings at https://platform.openai.com/settings/organization/billing."
        );
      }

      if (status === 401) {
        return new Error("OpenAI API key is invalid or expired. Please check your OPENAI_API_KEY.");
      }

      if (status === 429) {
        return new Error("OpenAI rate limit exceeded. Please try again in a few moments.");
      }

      if (status === 400 && message.toLowerCase().includes("model")) {
        return new Error(
          `OpenAI model error: ${message}. You may not have access to this model or it may not be available for image generation.`
        );
      }

      return new Error(`OpenAI API error (${status}): ${message}`);
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error("An unexpected error occurred with OpenAI");
  }

  protected getApiKeyEnvVar(): string | null {
    return "OPENAI_API_KEY";
  }
}
