import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import type {
  AIGatewayInterface,
  GatewayConfig,
  GatewayResponse,
  ModelInfo,
  RateLimitInfo,
} from "./ai-gateway.interface";
import type { AITaskType } from "@creator-hub/shared-types";

// ──────────────────────────────────────────────
// OPENROUTER API RESPONSE TYPES
// ──────────────────────────────────────────────

interface OpenRouterModelResponse {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string; // Price per token as string
    completion: string;
    image?: string; // Price per image (for image models)
  };
  context_length?: number;
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    modality?: string; // "text+image" | "text" | "image"
    tokenizer?: string;
  };
}

interface OpenRouterChatResponse {
  id: string;
  model: string;
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

interface OpenRouterImageResponse {
  id: string;
  data: Array<{
    url: string;
    b64_json?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// ──────────────────────────────────────────────
// TASK TYPE MAPPING
// ──────────────────────────────────────────────

function inferTaskType(model: OpenRouterModelResponse): AITaskType {
  const id = model.id.toLowerCase();
  const modality = model.architecture?.modality || "";

  // Image generation models
  if (
    id.includes("flux") ||
    id.includes("stable-diffusion") ||
    id.includes("dall-e") ||
    id.includes("gpt-image") ||
    id.includes("imagen") ||
    id.includes("midjourney") ||
    (id.includes("gemini") && id.includes("image")) ||
    id.includes("flash-image") ||
    (modality.includes("image") && !modality.includes("text"))
  ) {
    return "image-generation";
  }

  // Video generation models
  if (
    id.includes("video") ||
    id.includes("wan") ||
    id.includes("sora") ||
    id.includes("kling")
  ) {
    return "video-generation";
  }

  // Audio/speech models
  if (
    id.includes("whisper") ||
    id.includes("tts") ||
    id.includes("speech") ||
    id.includes("audio")
  ) {
    return "speech-to-text";
  }

  // Default to text generation (chat models)
  return "text-generation";
}

// ──────────────────────────────────────────────
// GATEWAY IMPLEMENTATION
// ──────────────────────────────────────────────

@Injectable()
export class OpenRouterGateway implements AIGatewayInterface {
  readonly type = "openrouter" as const;
  readonly baseUrl: string;
  private logger = new Logger("OpenRouterGateway");
  private config: GatewayConfig;
  private modelsCache: Map<string, ModelInfo> = new Map();
  private modelsCacheExpiry = 0;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.config = {
      baseUrl: this.baseUrl,
      apiKey: process.env.OPENROUTER_API_KEY || "",
      timeout: 120_000, // 2 minutes for image generation
      maxRetries: 2,
    };
  }

  validateConfig(): boolean {
    return !!this.config.apiKey;
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
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://creatorhub.app",
        "X-Title": "Creator Hub",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterChatResponse;
    const latency = Date.now() - startTime;

    this.logger.info("Chat completion completed", {
      model: params.model,
      latency,
      tokens: data.usage?.total_tokens,
    });

    return {
      id: data.id,
      model: data.model,
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
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://creatorhub.app",
        "X-Title": "Creator Hub",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 60_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
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

    // Always use dedicated image generation endpoint
    // If the model doesn't support it, OpenRouter will return an error
    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
    };

    if (params.negativePrompt) {
      body.negative_prompt = params.negativePrompt;
    }

    if (params.width && params.height) {
      body.size = `${params.width}x${params.height}`;
    }

    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://creatorhub.app",
        "X-Title": "Creator Hub",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OpenRouterImageResponse;
    const latency = Date.now() - startTime;

    this.logger.info("Image generation completed", {
      model: params.model,
      latency,
    });

    return {
      id: data.id,
      model: params.model,
      imageUrl: data.data[0]?.url,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: 0,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      rawResponse: data as unknown as Record<string, unknown>,
    };
  }

  // ──────────────────────────────────────────────
  // VIDEO GENERATION
  // ──────────────────────────────────────────────

  async videoGeneration(params: {
    model: string;
    prompt: string;
    width?: number;
    height?: number;
    imageUrl?: string;
    duration?: number;
    audioEnabled?: boolean;
    quality?: string;
  }): Promise<GatewayResponse> {
    const startTime = Date.now();

    const body: Record<string, unknown> = {
      model: params.model,
      prompt: params.prompt,
    };

    if (params.width && params.height) {
      body.size = `${params.width}x${params.height}`;
    }

    if (params.imageUrl) {
      body.image_url = params.imageUrl;
    }

    if (params.duration) {
      body.duration = params.duration;
    }

    if (params.audioEnabled !== undefined) {
      body.audio = params.audioEnabled;
    }

    if (params.quality) {
      body.resolution = params.quality;
    }

    this.logger.info("Submitting video generation", {
      model: params.model,
      duration: params.duration,
      quality: params.quality,
      audioEnabled: params.audioEnabled,
    });

    const response = await fetch(`${this.baseUrl}/videos/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "https://creatorhub.app",
        "X-Title": "Creator Hub",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout || 120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { id: string };
    const generationId = data.id;

    if (!generationId) {
      throw new Error("OpenRouter returned no generation ID");
    }

    // Poll for completion
    const maxAttempts = 120;
    const pollInterval = 5000;
    let videoUrl: string | null = null;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));

      let statusRes: Response;
      try {
        statusRes = await fetch(
          `${this.baseUrl}/videos/generations/${generationId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.config.apiKey}`,
              "HTTP-Referer": process.env.APP_URL || "https://creatorhub.app",
              "X-Title": "Creator Hub",
            },
            signal: AbortSignal.timeout(30_000),
          },
        );
      } catch {
        continue;
      }

      if (!statusRes.ok) continue;

      const statusData = (await statusRes.json()) as {
        status?: string;
        video_url?: string;
        error?: { message?: string };
      };

      const status = statusData.status?.toLowerCase();
      const resolvedUrl = statusData.video_url;

      if (i === 0 || (i + 1) % 10 === 0 || resolvedUrl || status === "failed") {
        this.logger.info(`Video generation poll #${i + 1}/${maxAttempts}`, {
          generationId,
          status,
          hasUrl: !!resolvedUrl,
        });
      }

      if ((status === "completed" || status === "succeeded") && resolvedUrl) {
        videoUrl = resolvedUrl;
        break;
      }

      if (status === "failed") {
        throw new Error(
          `OpenRouter video generation failed: ${statusData.error?.message || "unknown"}`,
        );
      }
    }

    if (!videoUrl) {
      throw new Error("OpenRouter video generation timed out after 10 minutes");
    }

    const latency = Date.now() - startTime;

    this.logger.info("Video generation completed", {
      model: params.model,
      generationId,
      latency,
    });

    return {
      id: generationId,
      model: params.model,
      imageUrl: videoUrl, // Reusing imageUrl field for video URL
      rawResponse: { videoUrl, generationId },
    };
  }

  // ──────────────────────────────────────────────
  // LIST MODELS
  // ──────────────────────────────────────────────

  async listModels(): Promise<ModelInfo[]> {
    // Check cache
    if (this.modelsCache.size > 0 && Date.now() < this.modelsCacheExpiry) {
      return Array.from(this.modelsCache.values());
    }

    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      data: OpenRouterModelResponse[];
    };

    const models: ModelInfo[] = data.data.map((model) => ({
      id: model.id,
      name: model.name,
      taskType: inferTaskType(model),
      contextLength: model.context_length,
      maxOutputTokens: model.top_provider?.max_completion_tokens,
      supportsStreaming: true, // Most OpenRouter models support streaming
      supportsVision: model.architecture?.modality?.includes("image") || false,
      pricing: {
        promptPer1k: parseFloat(model.pricing.prompt) * 1000,
        completionPer1k: parseFloat(model.pricing.completion) * 1000,
        imagePerGen: model.pricing.image
          ? parseFloat(model.pricing.image)
          : undefined,
      },
      rateLimit: undefined, // OpenRouter handles rate limiting
      description: model.description,
      tags: [],
    }));

    // Update cache
    this.modelsCache.clear();
    for (const model of models) {
      this.modelsCache.set(model.id, model);
    }
    this.modelsCacheExpiry = Date.now() + this.CACHE_TTL;

    this.logger.info("Models list refreshed", { count: models.length });

    return models;
  }

  // ──────────────────────────────────────────────
  // GET MODEL
  // ──────────────────────────────────────────────

  async getModel(modelId: string): Promise<ModelInfo | null> {
    // Check cache first
    const cached = this.modelsCache.get(modelId);
    if (cached && Date.now() < this.modelsCacheExpiry) {
      return cached;
    }

    // Refresh cache
    await this.listModels();
    return this.modelsCache.get(modelId) || null;
  }

  // ──────────────────────────────────────────────
  // GET RATE LIMIT
  // ──────────────────────────────────────────────

  async getRateLimit(_modelId: string): Promise<RateLimitInfo | null> {
    // OpenRouter handles rate limiting internally
    // We can't get real-time rate limit info
    return null;
  }

  // ──────────────────────────────────────────────
  // CACHE MANAGEMENT
  // ──────────────────────────────────────────────

  /**
   * Force invalidate the models cache.
   * Useful when admin triggers a manual sync.
   */
  invalidateModelsCache(): void {
    this.modelsCache.clear();
    this.modelsCacheExpiry = 0;
    this.logger.info("Models cache invalidated");
  }
}
