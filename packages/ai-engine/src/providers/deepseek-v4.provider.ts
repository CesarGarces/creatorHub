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

const SYSTEM_PROMPT = `Actúas como un traductor profesional y experto en localización de contenido para creadores de internet.
Traduce el texto del usuario al idioma de destino de forma natural, manteniendo el impacto emocional y el tono original.
REGLA CRÍTICA: Devuelve ÚNICAMENTE la traducción resultante. No agregues introducciones, notas, ni ningún otro texto. Solo la traducción.`;

export class DeepSeekV4FlashProvider extends AIProviderBase {
  readonly name: AIProvider = "deepseek-v4";
  readonly supportedTasks: AITaskType[] = ["text-generation"];
  readonly supportedModels = ["deepseek-ai/DeepSeek-V4-Flash"];
  readonly tier = "free" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.callChatAPI(request, "deepseek-ai/DeepSeek-V4-Flash");
  }

  async generateImage(_options: ImageGenerationOptions): Promise<AIResponse> {
    throw new Error("DeepSeek V4 Flash does not support image generation");
  }

  async *generateStream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
    const temperature = (request.parameters?.temperature as number) ?? 0.7;
    const maxTokens = (request.parameters?.maxTokens as number) ?? 8000;
    const systemPrompt =
      (request.parameters?.systemPrompt as string) || SYSTEM_PROMPT;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

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
        model: "deepseek-ai/DeepSeek-V4-Flash",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek V4 Flash API error ${response.status}: ${errorText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("DeepSeek V4 Flash response body is not readable");
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

  private async callChatAPI(
    request: AIRequest,
    model: string,
  ): Promise<AIResponse> {
    const response = await fetch(SILICONFLOW_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: request.prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek V4 Flash API error ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek V4 Flash returned no content");
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

  protected getApiKeyEnvVar(): string | null {
    return "SILICONFLOW_API_KEY";
  }
}

export class DeepSeekV4ProProvider extends AIProviderBase {
  readonly name: AIProvider = "deepseek-v4-pro";
  readonly supportedTasks: AITaskType[] = ["text-generation"];
  readonly supportedModels = ["deepseek-ai/DeepSeek-V4-Pro"];
  readonly tier = "pro" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.callChatAPI(request, "deepseek-ai/DeepSeek-V4-Pro");
  }

  async generateImage(_options: ImageGenerationOptions): Promise<AIResponse> {
    throw new Error("DeepSeek V4 Pro does not support image generation");
  }

  async *generateStream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
    const temperature = (request.parameters?.temperature as number) ?? 0.7;
    const maxTokens = (request.parameters?.maxTokens as number) ?? 8000;
    const systemPrompt =
      (request.parameters?.systemPrompt as string) || SYSTEM_PROMPT;

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

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
        model: "deepseek-ai/DeepSeek-V4-Pro",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek V4 Pro API error ${response.status}: ${errorText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("DeepSeek V4 Pro response body is not readable");
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

  private async callChatAPI(
    request: AIRequest,
    model: string,
  ): Promise<AIResponse> {
    const response = await fetch(SILICONFLOW_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: request.prompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek V4 Pro API error ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { total_tokens: number };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("DeepSeek V4 Pro returned no content");
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
        credits: 10,
        tokens: data.usage?.total_tokens,
      },
      latency: 0,
    };
  }

  protected getApiKeyEnvVar(): string | null {
    return "SILICONFLOW_API_KEY";
  }
}
