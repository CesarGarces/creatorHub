import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
  AIStreamChunk,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";

const SILICONFLOW_CHAT_URL = "https://api.siliconflow.com/v1/chat/completions";
const SILICONFLOW_IMAGE_URL =
  "https://api.siliconflow.com/v1/images/generations";

export class SiliconFlowProvider extends AIProviderBase {
  readonly name: AIProvider = "siliconflow";
  readonly supportedTasks: AITaskType[] = [
    "image-generation",
    "text-generation",
  ];
  readonly supportedModels = [
    "black-forest-labs/FLUX.2-pro",
    "black-forest-labs/FLUX.1-Kontext-max",
    "Tongyi-MAI/Z-Image-Turbo",
    "deepseek-ai/DeepSeek-V4-Flash",
    "deepseek-ai/DeepSeek-V4-Pro",
    "THUDM/glm-4-9b-chat",
    "THUDM/glm-4-plus",
  ];
  readonly tier = "free" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    if (request.taskType === "text-generation") {
      return this.generateText(request);
    }
    // Default to image generation
    return this.generateImage({
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      model: request.model as string | undefined,
      width: (request.parameters?.width as number) || 1024,
      height: (request.parameters?.height as number) || 1024,
      imageUrl: request.parameters?.imageUrl as string | undefined,
    });
  }

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    const isKontext = !!options.imageUrl;

    // Resolve model: prefer explicit option, fallback to defaults
    const resolvedModel =
      options.model ||
      (isKontext
        ? "black-forest-labs/FLUX.1-Kontext-max"
        : "black-forest-labs/FLUX.2-pro");

    console.log("[SiliconFlowProvider] generateImage called with:", {
      optionsModel: options.model,
      resolvedModel,
      isKontext,
    });

    // Extract just the model name for display (strip provider prefix if present)
    const displayName = resolvedModel.includes("/")
      ? resolvedModel.split("/").pop()!
      : resolvedModel;

    const body: Record<string, unknown> = {
      model: resolvedModel,
      prompt: options.prompt,
      image_size: `${options.width || 1024}x${options.height || 1024}`,
    };

    if (isKontext) {
      body.input_image = options.imageUrl;
    } else if (options.negativePrompt) {
      body.negative_prompt = options.negativePrompt;
    }

    const response = await fetch(SILICONFLOW_IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

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
      model: displayName,
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

  async generateText(request: AIRequest): Promise<AIResponse> {
    const model = (request.model as string) || "deepseek-ai/DeepSeek-V4-Flash";
    const temperature = (request.parameters?.temperature as number) ?? 0.7;
    const maxTokens = (request.parameters?.maxTokens as number) ?? 4096;
    const systemPrompt = request.parameters?.systemPrompt as string | undefined;

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    const conversationHistory = request.parameters
      ?.conversationHistory as Array<{ role: string; content: string }>;

    if (conversationHistory) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: "user", content: request.prompt });

    const response = await fetch(SILICONFLOW_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("SiliconFlow returned no content");
    }

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model,
      output: {
        type: "text",
        content: content.trim(),
      },
      usage: {
        credits: 5,
        tokens: data.usage?.total_tokens,
      },
      latency: 0,
    };
  }

  async *generateStream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
    const model = (request.model as string) || "deepseek-ai/DeepSeek-V4-Flash";
    const temperature = (request.parameters?.temperature as number) ?? 0.7;
    const maxTokens = (request.parameters?.maxTokens as number) ?? 8000;
    const systemPrompt = request.parameters?.systemPrompt as string | undefined;

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    const conversationHistory = request.parameters
      ?.conversationHistory as Array<{ role: string; content: string }>;

    if (conversationHistory) {
      messages.push(...conversationHistory);
    }

    messages.push({ role: "user", content: request.prompt });

    const response = await fetch(SILICONFLOW_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("SiliconFlow response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") {
            yield { type: "done" };
            return;
          }

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{ delta?: { content?: string } }>;
              usage?: { total_tokens: number };
            };

            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: "content", content };
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: "done" };
  }

  protected getApiKeyEnvVar(): string | null {
    return "SILICONFLOW_API_KEY";
  }
}
