import { AIProviderBase } from "./ai-provider.base";
import type { AIRequest, AIResponse, AITaskType, AIProvider } from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

export class GeminiProvider extends AIProviderBase {
  readonly name: AIProvider = "gemini";
  readonly supportedTasks: AITaskType[] = [
    "image-generation",
    "text-generation",
    "text-analysis",
  ];
  readonly supportedModels = ["gemini-pro-vision", "gemini-pro"];

  async generate(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.getApiKey();
    const model = request.model || "gemini-pro";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: request.prompt }] }],
        }),
      }
    );

    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model,
      output: {
        type: "text",
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
      },
      usage: { credits: 1 },
      latency: 0,
    };
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    return this.generate({
      taskType: "image-generation",
      prompt: options.prompt,
      model: "gemini-pro-vision",
    });
  }

  protected getApiKeyEnvVar(): string | null {
    return "GEMINI_API_KEY";
  }
}
