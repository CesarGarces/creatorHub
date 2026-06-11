import OpenAI from "openai";
import { AIProviderBase } from "./ai-provider.base";
import type { AIRequest, AIResponse, AITaskType, AIProvider } from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class OpenAIImageProvider extends AIProviderBase {
  readonly name: AIProvider = "openai";
  readonly supportedTasks: AITaskType[] = [
    "image-generation",
    "image-editing",
    "image-variation",
    "text-generation",
    "text-analysis",
  ];
  readonly supportedModels = ["gpt-image-1", "gpt-4o", "gpt-4o-mini"];

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
    const response = await this.client.images.generate({
      model: "gpt-image-1",
      prompt: options.prompt,
      n: options.numberOfImages || 1,
      size: "1024x1024",
    });

    const image = response.data?.[0];
    if (!image?.url) {
      throw new Error("OpenAI returned no image URL. The API key may be invalid or expired.");
    }

    return {
      id: response.created.toString(),
      provider: this.name,
      model: "gpt-image-1",
      output: {
        type: "image",
        url: image.url,
        width: 1024,
        height: 1024,
      } as const,
      usage: { credits: 1 },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "OPENAI_API_KEY";
  }
}
