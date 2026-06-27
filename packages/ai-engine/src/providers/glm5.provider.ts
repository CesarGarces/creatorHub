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

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente de Creator Hub, una plataforma para creadores de contenido.
Tienes acceso a herramientas dinámicas del sistema. Cuando el usuario pida algo que coincida con una herramienta disponible, responde con un JSON de acción:
{ "action": "route_to_tool", "toolId": "<id>", "params": { ... } }

Para preguntas generales, responde de forma concisa y útil en markdown.
Sé amable, profesional y directo.`;

export class GLM5Provider extends AIProviderBase {
  readonly name: AIProvider = "glm5";
  readonly supportedTasks: AITaskType[] = ["text-generation"];
  readonly supportedModels = ["zai-org/GLM-5.2"];
  readonly tier = "free" as const;

  async generate(request: AIRequest): Promise<AIResponse> {
    const temperature = (request.parameters?.temperature as number) ?? 0.7;
    const maxTokens = (request.parameters?.maxTokens as number) ?? 8000;
    const systemPrompt =
      (request.parameters?.systemPrompt as string) || DEFAULT_SYSTEM_PROMPT;

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
        model: "zai-org/GLM-5.2",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM-5.2 API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: {
        total_tokens: number;
        prompt_tokens: number;
        completion_tokens: number;
      };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("GLM-5.2 returned no content");
    }

    return {
      id: crypto.randomUUID(),
      provider: this.name,
      model: "zai-org/GLM-5.2",
      output: {
        type: "text",
        content: content.trim(),
      },
      usage: {
        credits: 3,
        tokens: data.usage?.total_tokens,
      },
      latency: 0,
    };
  }

  async *generateStream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
    const temperature = (request.parameters?.temperature as number) ?? 0.7;
    const maxTokens = (request.parameters?.maxTokens as number) ?? 8000;
    const systemPrompt =
      (request.parameters?.systemPrompt as string) || DEFAULT_SYSTEM_PROMPT;

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
        model: "zai-org/GLM-5.2",
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GLM-5.2 API error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("GLM-5.2 response body is not readable");
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

  async generateImage(_options: ImageGenerationOptions): Promise<AIResponse> {
    throw new Error("GLM-5.2 does not support image generation");
  }

  protected getApiKeyEnvVar(): string | null {
    return "SILICONFLOW_API_KEY";
  }
}
