import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import type {
  AIGatewayInterface,
  GatewayResponse,
  ModelInfo,
  RateLimitInfo,
} from "./ai-gateway.interface";
import type { AITaskType } from "@creator-hub/shared-types";

// ──────────────────────────────────────────────
// SILICONFLOW API RESPONSE TYPES
// ──────────────────────────────────────────────

interface SiliconFlowChatResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface SiliconFlowImageResponse {
  images: Array<{
    url: string;
  }>;
}

interface SiliconFlowVideoResponse {
  request_id: string;
  status: string;
}

interface SiliconFlowVideoStatusResponse {
  request_id: string;
  status: string;
  video?: {
    url: string;
  };
}

// ──────────────────────────────────────────────
// GATEWAY IMPLEMENTATION
// ──────────────────────────────────────────────

@Injectable()
export class SiliconFlowGateway implements AIGatewayInterface {
  readonly type = "siliconflow" as const;
  readonly baseUrl = "https://api.siliconflow.com/v1";
  private logger = new Logger("SiliconFlowGateway");
  private apiKey: string;

  // Known models and their capabilities
  private knownModels: ModelInfo[] = [
    {
      id: "black-forest-labs/FLUX.2-pro",
      name: "FLUX 2 Pro",
      taskType: "image-generation",
      supportsStreaming: false,
      supportsVision: false,
      pricing: { promptPer1k: 0, imagePerGen: 0.05 },
      tags: ["fast", "high-quality"],
    },
    {
      id: "black-forest-labs/FLUX.1-Kontext-max",
      name: "FLUX Kontext Max",
      taskType: "image-generation",
      supportsStreaming: false,
      supportsVision: true,
      pricing: { promptPer1k: 0, imagePerGen: 0.08 },
      tags: ["image-editing"],
    },
    {
      id: "Tongyi-MAI/Z-Image-Turbo",
      name: "Z-Image Turbo",
      taskType: "image-generation",
      supportsStreaming: false,
      supportsVision: false,
      pricing: { promptPer1k: 0, imagePerGen: 0.01 },
      tags: ["fast", "cheap"],
    },
    {
      id: "deepseek-ai/DeepSeek-V4-Flash",
      name: "DeepSeek V4 Flash",
      taskType: "text-generation",
      supportsStreaming: true,
      supportsVision: false,
      pricing: { promptPer1k: 0.0001, completionPer1k: 0.0002 },
      tags: ["fast", "cheap", "chat"],
    },
    {
      id: "deepseek-ai/DeepSeek-V4-Pro",
      name: "DeepSeek V4 Pro",
      taskType: "text-generation",
      supportsStreaming: true,
      supportsVision: false,
      pricing: { promptPer1k: 0.0005, completionPer1k: 0.001 },
      tags: ["high-quality", "chat"],
    },
    {
      id: "zai-org/GLM-5.2",
      name: "GLM-5.2",
      taskType: "text-generation",
      supportsStreaming: true,
      supportsVision: false,
      pricing: { promptPer1k: 0.0003, completionPer1k: 0.0006 },
      tags: ["chat", "multilingual"],
    },
    {
      id: "Wan-AI/Wan2.2-T2V-A14B",
      name: "Wan AI Text-to-Video",
      taskType: "video-generation",
      supportsStreaming: false,
      supportsVision: false,
      pricing: { promptPer1k: 0, imagePerGen: 0.5 },
      tags: ["video", "text-to-video"],
    },
    {
      id: "Wan-AI/Wan2.2-I2V-A14B",
      name: "Wan AI Image-to-Video",
      taskType: "video-generation",
      supportsStreaming: false,
      supportsVision: true,
      pricing: { promptPer1k: 0, imagePerGen: 0.5 },
      tags: ["video", "image-to-video"],
    },
  ];

  constructor() {
    this.apiKey = process.env.SILICONFLOW_API_KEY || "";
  }

  validateConfig(): boolean {
    return !!this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  // ──────────────────────────────────────────────
  // CHAT COMPLETION
  // ──────────────────────────────────────────────

  async chatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<GatewayResponse> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
    };

    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as SiliconFlowChatResponse;
    const latency = Date.now() - startTime;

    this.logger.info("Chat completion completed", {
      model: params.model,
      latency,
      tokens: data.usage?.total_tokens,
    });

    return {
      id: data.id,
      model: params.model,
      content: data.choices[0]?.message?.content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: data.choices[0]?.finish_reason,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  // ──────────────────────────────────────────────
  // CHAT COMPLETION STREAM
  // ──────────────────────────────────────────────

  async *chatCompletionStream(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<{
    chunk: string;
    done: boolean;
    usage?: GatewayResponse["usage"];
  }> {
    const body: Record<string, unknown> = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      stream: true,
    };

    if (params.maxTokens) {
      body.max_tokens = params.maxTokens;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
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
            yield { chunk: "", done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{
                delta?: { content?: string };
                finish_reason?: string;
              }>;
              usage?: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
              };
            };

            const content = parsed.choices?.[0]?.delta?.content || "";
            const finishReason = parsed.choices?.[0]?.finish_reason;

            if (content) {
              yield { chunk: content, done: false };
            }

            if (finishReason === "stop") {
              yield {
                chunk: "",
                done: true,
                usage: parsed.usage
                  ? {
                      promptTokens: parsed.usage.prompt_tokens,
                      completionTokens: parsed.usage.completion_tokens,
                      totalTokens: parsed.usage.total_tokens,
                    }
                  : undefined,
              };
              return;
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ──────────────────────────────────────────────
  // IMAGE GENERATION
  // ──────────────────────────────────────────────

  async imageGeneration(params: {
    model: string;
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    imageUrl?: string;
  }): Promise<GatewayResponse> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
      image_size: `${params.width || 1024}x${params.height || 1024}`,
    };

    // Kontext model supports image-to-image
    if (params.imageUrl && params.model.includes("Kontext")) {
      body.input_image = params.imageUrl;
    } else if (params.negativePrompt) {
      body.negative_prompt = params.negativePrompt;
    }

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // 2 minutes for image generation
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as SiliconFlowImageResponse;
    const latency = Date.now() - startTime;

    this.logger.info("Image generation completed", {
      model: params.model,
      latency,
    });

    return {
      id: crypto.randomUUID(),
      model: params.model,
      imageUrl: data.images[0]?.url,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  // ──────────────────────────────────────────────
  // VIDEO GENERATION (Submit)
  // ──────────────────────────────────────────────

  async videoGeneration(params: {
    model: string;
    prompt: string;
    imageUrl?: string;
  }): Promise<{ requestId: string }> {
    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
    };

    if (params.imageUrl) {
      body.image = params.imageUrl;
    }

    const response = await fetch(`${this.baseUrl}/video/submit`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as SiliconFlowVideoResponse;
    return { requestId: data.request_id };
  }

  // ──────────────────────────────────────────────
  // VIDEO GENERATION (Poll Status)
  // ──────────────────────────────────────────────

  async getVideoStatus(
    requestId: string,
  ): Promise<{ status: string; videoUrl?: string }> {
    const response = await fetch(`${this.baseUrl}/video/status/${requestId}`, {
      method: "GET",
      headers: this.getHeaders(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as SiliconFlowVideoStatusResponse;
    return {
      status: data.status,
      videoUrl: data.video?.url,
    };
  }

  // ──────────────────────────────────────────────
  // LIST MODELS
  // ──────────────────────────────────────────────

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey) {
      this.logger.warn(
        "SILICONFLOW_API_KEY not configured, returning known models only",
      );
      return [...this.knownModels];
    }

    try {
      const allModels: ModelInfo[] = [];

      // Fetch all model types: text, image, audio, video
      const types = ["text", "image", "audio", "video"];

      for (const type of types) {
        const response = await fetch(
          `https://api.siliconflow.com/v1/models?type=${type}`,
          {
            method: "GET",
            headers: this.getHeaders(),
            signal: AbortSignal.timeout(15_000),
          },
        );

        if (!response.ok) {
          this.logger.warn(
            `Failed to fetch SiliconFlow models (type=${type}): ${response.status}`,
          );
          continue;
        }

        const data = (await response.json()) as {
          data: Array<{
            id: string;
            object: string;
            created: number;
            owned_by: string;
          }>;
        };

        for (const model of data.data ?? []) {
          // Skip embeddings, rerankers, etc.
          if (model.id.includes("embedding") || model.id.includes("reranker"))
            continue;

          const known = this.knownModels.find((k) => k.id === model.id);
          const taskType =
            known?.taskType ?? this.inferTaskType(model.id, type);
          const pricing = known?.pricing ?? {
            promptPer1k: 0,
            completionPer1k: 0,
          };

          allModels.push({
            id: model.id,
            name: this.humanizeModelId(model.id),
            taskType,
            supportsStreaming: taskType === "text-generation",
            supportsVision: known?.supportsVision ?? false,
            pricing,
            contextLength: known?.contextLength,
            description: known?.description,
            tags: known?.tags ?? [type],
          });
        }
      }

      this.logger.info(
        `Fetched ${allModels.length} models from SiliconFlow API`,
      );
      return allModels.length > 0 ? allModels : [...this.knownModels];
    } catch (error) {
      this.logger.warn(
        "Failed to fetch models from SiliconFlow API, returning known models",
        { error: String(error) },
      );
      return [...this.knownModels];
    }
  }

  /**
   * Infer taskType from model ID and API type
   */
  private inferTaskType(
    modelId: string,
    apiType: string,
  ):
    | "text-generation"
    | "image-generation"
    | "video-generation"
    | "speech-to-text" {
    const lower = modelId.toLowerCase();

    if (
      apiType === "image" ||
      lower.includes("flux") ||
      lower.includes("stable-diffusion") ||
      lower.includes("dall-e")
    ) {
      return "image-generation";
    }
    if (
      apiType === "video" ||
      lower.includes("video") ||
      lower.includes("wan")
    ) {
      return "video-generation";
    }
    if (
      apiType === "audio" ||
      lower.includes("whisper") ||
      lower.includes("speech")
    ) {
      return "speech-to-text";
    }
    return "text-generation";
  }

  /**
   * Convert model ID to human-readable name
   */
  private humanizeModelId(modelId: string): string {
    const parts = modelId.split("/");
    const raw = parts[parts.length - 1] ?? modelId;
    return raw.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ──────────────────────────────────────────────
  // GET MODEL
  // ──────────────────────────────────────────────

  async getModel(modelId: string): Promise<ModelInfo | null> {
    return this.knownModels.find((m) => m.id === modelId) || null;
  }

  // ──────────────────────────────────────────────
  // GET RATE LIMIT
  // ──────────────────────────────────────────────

  async getRateLimit(_modelId: string): Promise<RateLimitInfo | null> {
    // SiliconFlow rate limits are per API key, not per model
    // Return null for now
    return null;
  }
}
