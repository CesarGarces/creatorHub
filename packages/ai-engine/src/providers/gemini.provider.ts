import { GoogleGenAI } from "@google/genai";
import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class GeminiProvider extends AIProviderBase {
  readonly name: AIProvider = "gemini";
  readonly supportedTasks: AITaskType[] = [
    "text-generation",
    "text-analysis",
    "image-generation",
  ];
  readonly supportedModels = ["gemini-2.5-flash", "gemini-2.5-flash-image"];

  private getClient(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: this.getApiKey() });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const ai = this.getClient();
    const model = (request.model as string) || "gemini-2.5-flash";

    const response = await ai.models.generateContent({
      model,
      contents: request.prompt,
    });

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model,
      output: {
        type: "text",
        content: response.text || "",
      },
      usage: { credits: 1 },
      latency: 0,
    };
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const ai = this.getClient();
    const model = "gemini-2.5-flash-image";

    const response = await ai.models.generateContent({
      model,
      contents: options.prompt,
      config: {
        responseModalities: ["IMAGE"],
      },
    });

    const candidates = response.candidates;
    if (!candidates?.[0]?.content?.parts) {
      throw new Error("Gemini returned no content parts");
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData?.data) {
        const dataUri = `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        return {
          id: crypto.randomUUID(),
          provider: this.name,
          model,
          output: {
            type: "image",
            url: dataUri,
            width: options.width || 1024,
            height: options.height || 1024,
          },
          usage: { credits: 1 },
          latency: 0,
        };
      }
    }

    throw new Error("Gemini returned no image data");
  }

  protected getApiKeyEnvVar(): string | null {
    return "GEMINI_API_KEY";
  }
}
