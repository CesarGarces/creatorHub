import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import type { ModelInfo } from "../gateways/ai-gateway.interface";

/**
 * OpenRouterModelsService - Fetches and caches model info from OpenRouter API.
 *
 * This service:
 * - Fetches all available models from OpenRouter
 * - Parses pricing, capabilities, and metadata
 * - Caches results for 1 hour
 * - Provides filtering by task type, capability, etc.
 */
@Injectable()
export class OpenRouterModelsService {
  private logger = new Logger("OpenRouterModelsService");
  private cache: Map<string, ModelInfo> = new Map();
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.apiKey = process.env.OPENROUTER_API_KEY || "";
  }

  /**
   * Fetch all models from OpenRouter API
   * Fetches both text/image models AND video generation models (separate endpoints)
   */
  async fetchModels(): Promise<ModelInfo[]> {
    // Check cache
    if (this.cache.size > 0 && Date.now() < this.cacheExpiry) {
      return Array.from(this.cache.values());
    }

    if (!this.apiKey) {
      this.logger.warn(
        "OPENROUTER_API_KEY not configured, returning empty list",
      );
      return [];
    }

    try {
      // Fetch text/image models AND video models in parallel
      const [textModels, videoModels] = await Promise.all([
        this.fetchTextImageModels(),
        this.fetchVideoModels(),
      ]);

      const models: ModelInfo[] = [...textModels, ...videoModels];

      // Update cache
      this.cache.clear();
      for (const model of models) {
        this.cache.set(model.id, model);
      }
      this.cacheExpiry = Date.now() + this.CACHE_TTL;

      this.logger.info("Models fetched from OpenRouter", {
        count: models.length,
        textImage: textModels.length,
        video: videoModels.length,
      });

      return models;
    } catch (error) {
      this.logger.error("Failed to fetch models from OpenRouter", {
        error: (error as Error).message,
      });
      // Return cached data if available
      return Array.from(this.cache.values());
    }
  }

  /**
   * Fetch text/image models from GET /api/v1/models
   */
  private async fetchTextImageModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      data: Array<{
        id: string;
        name: string;
        description?: string;
        pricing: {
          prompt: string;
          completion: string;
          image?: string;
        };
        context_length?: number;
        top_provider?: {
          max_completion_tokens?: number;
        };
        architecture?: {
          modality?: string;
        };
      }>;
    };

    return data.data.map((model) => ({
      id: model.id,
      name: model.name,
      taskType: this.inferTaskType(model),
      contextLength: model.context_length,
      maxOutputTokens: model.top_provider?.max_completion_tokens,
      supportsStreaming: true,
      supportsVision: model.architecture?.modality?.includes("image") || false,
      pricing: {
        promptPer1k: parseFloat(model.pricing.prompt) * 1000,
        completionPer1k: parseFloat(model.pricing.completion) * 1000,
        imagePerGen: model.pricing.image
          ? parseFloat(model.pricing.image)
          : undefined,
      },
      description: model.description,
      tags: this.inferTags(model),
    }));
  }

  /**
   * Fetch video generation models from GET /api/v1/videos/models
   *
   * Video models use a different API and have a different schema:
   * - pricing_skus instead of pricing (per-second, per-resolution)
   * - supported_resolutions, supported_durations, supported_frame_images
   * - No context_length or architecture.modality
   */
  private async fetchVideoModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.baseUrl}/videos/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        this.logger.warn(`Failed to fetch video models: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          name: string;
          description?: string;
          supported_resolutions?: string[];
          supported_durations?: number[];
          supported_frame_images?: string[];
          pricing_skus?: Record<string, string>;
        }>;
      };

      return data.data.map((model) => ({
        id: model.id,
        name: model.name,
        taskType: "video-generation" as const,
        supportsStreaming: false, // Video is async (job-based), not streaming
        supportsVision: (model.supported_frame_images?.length ?? 0) > 0, // Accepts image input = i2v support
        pricing: {
          // Use cheapest per-second pricing as base imagePerGen
          // Actual cost depends on duration × resolution
          imagePerGen: this.parseVideoPricing(model.pricing_skus),
        },
        description: model.description,
        tags: [
          "video",
          ...(model.supported_resolutions?.includes("1080p")
            ? ["high-quality"]
            : []),
          ...(model.supported_durations &&
          Math.max(...model.supported_durations) >= 10
            ? ["long-form"]
            : []),
        ],
      }));
    } catch (error) {
      this.logger.warn("Failed to fetch video models from OpenRouter", {
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Parse video pricing from pricing_skus to a base USD cost.
   * Handles three formats:
   *   - "duration_seconds_720p": "0.0988" (Alibaba, Kling, etc.) — USD per second
   *   - "cents_per_video_output_second_480p": "8" (older ByteDance) — cents per second
   *   - "video_tokens": "0.0000056" (ByteDance Seedance) — USD per token
   *     Token formula: (height * width * duration * 24) / 1024
   *     Base estimate: 480x480 4s = ~21.5K tokens
   */
  private parseVideoPricing(
    pricingSkus?: Record<string, string>,
  ): number | undefined {
    if (!pricingSkus) return undefined;

    const perSecondPrices: number[] = [];
    let pricePerToken: number | undefined;

    for (const [key, value] of Object.entries(pricingSkus)) {
      const lowerKey = key.toLowerCase();
      const numValue = parseFloat(value);
      if (isNaN(numValue)) continue;

      // Per-second pricing (USD or cents)
      if (
        lowerKey.includes("per_video_output_second") ||
        lowerKey.includes("duration_seconds")
      ) {
        let price = numValue;
        if (lowerKey.includes("cents_")) {
          price = numValue / 100;
        }
        perSecondPrices.push(price);
      }

      // Token-based pricing (ByteDance Seedance)
      if (
        lowerKey === "video_tokens" ||
        lowerKey === "video_tokens_without_audio"
      ) {
        // Pick the cheaper token rate (with vs without audio)
        if (pricePerToken === undefined || numValue < pricePerToken) {
          pricePerToken = numValue;
        }
      }
    }

    // Per-second pricing
    if (perSecondPrices.length > 0) {
      const cheapestPerSec = Math.min(...perSecondPrices);
      return cheapestPerSec * 4; // ~4 second video as base
    }

    // Token-based pricing: estimate for 480x480 4-second video
    // Tokens = (480 * 480 * 4 * 24) / 1024 ≈ 21,504
    if (pricePerToken !== undefined) {
      const estimatedTokens = (480 * 480 * 4 * 24) / 1024;
      return pricePerToken * estimatedTokens;
    }

    return undefined;
  }

  /**
   * Get a specific model by ID
   */
  async getModel(modelId: string): Promise<ModelInfo | null> {
    const models = await this.fetchModels();
    return models.find((m) => m.id === modelId) || null;
  }

  /**
   * Get models filtered by task type
   */
  async getModelsByTaskType(taskType: string): Promise<ModelInfo[]> {
    const models = await this.fetchModels();
    return models.filter((m) => m.taskType === taskType);
  }

  /**
   * Get models filtered by capability
   */
  async getModelsByCapability(
    capability: "streaming" | "vision",
  ): Promise<ModelInfo[]> {
    const models = await this.fetchModels();
    switch (capability) {
      case "streaming":
        return models.filter((m) => m.supportsStreaming);
      case "vision":
        return models.filter((m) => m.supportsVision);
    }
  }

  /**
   * Search models by name or description
   */
  async searchModels(query: string): Promise<ModelInfo[]> {
    const models = await this.fetchModels();
    const lowerQuery = query.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.id.toLowerCase().includes(lowerQuery) ||
        m.description?.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * Force refresh cache
   */
  async refreshCache(): Promise<ModelInfo[]> {
    this.cache.clear();
    this.cacheExpiry = 0;
    return this.fetchModels();
  }

  /**
   * Infer task type from model metadata.
   *
   * OpenRouter modality format: "input->output"
   *   "text+image->text+image"  → generates images
   *   "text+image+file->text"   → text only (accepts images but doesn't generate)
   *   "text+image+file+audio+video->text" → text only (accepts video input)
   *
   * We classify by what the model OUTPUTS, not what it accepts as input.
   * Order matters: video before image (some video IDs contain "image").
   */
  private inferTaskType(model: {
    id: string;
    architecture?: { modality?: string };
    description?: string;
  }):
    | "image-generation"
    | "text-generation"
    | "video-generation"
    | "speech-to-text" {
    const id = model.id.toLowerCase();
    const desc = (model.description || "").toLowerCase();
    const modality = model.architecture?.modality || "";

    // Parse output modality (after "->")
    const outputModality = modality.includes("->")
      ? modality.split("->")[1] || ""
      : modality;
    const inputModality = modality.includes("->")
      ? modality.split("->")[0] || ""
      : modality;

    // ── Video generation: output must include "video" ──
    if (
      outputModality.includes("video") ||
      id.includes("happyhorse") ||
      id.includes("kling") ||
      id.includes("sora") ||
      (id.includes("wan") && id.includes("video"))
    ) {
      return "video-generation";
    }

    // ── Image generation: output includes "image", OR strong keyword match ──
    if (
      outputModality.includes("image") ||
      id.includes("flux") ||
      id.includes("stable-diffusion") ||
      id.includes("dall-e") ||
      id.includes("gpt-image") ||
      id.includes("imagen") ||
      id.includes("banana") ||
      id.includes("midjourney") ||
      id.includes("ideogram") ||
      (id.includes("gpt-5") && id.includes("image"))
    ) {
      return "image-generation";
    }

    // ── Audio/speech ──
    if (
      id.includes("whisper") ||
      id.includes("tts") ||
      id.includes("speech-to-text")
    ) {
      return "speech-to-text";
    }

    // ── Default: text generation ──
    return "text-generation";
  }

  /**
   * Infer tags from model metadata
   */
  private inferTags(model: {
    id: string;
    pricing: { prompt: string; completion: string };
    context_length?: number;
  }): string[] {
    const tags: string[] = [];
    const id = model.id.toLowerCase();

    // Speed tags
    if (
      id.includes("flash") ||
      id.includes("mini") ||
      id.includes("turbo") ||
      id.includes("fast")
    ) {
      tags.push("fast");
    }

    // Quality tags
    if (
      id.includes("pro") ||
      id.includes("ultra") ||
      id.includes("max") ||
      id.includes("plus")
    ) {
      tags.push("high-quality");
    }

    // Size tags
    if (model.context_length && model.context_length >= 100_000) {
      tags.push("long-context");
    }

    // Price tags
    const promptPrice = parseFloat(model.pricing.prompt);
    if (promptPrice < 0.0000005) {
      tags.push("cheap");
    } else if (promptPrice > 0.00001) {
      tags.push("premium");
    }

    // Provider tags
    if (id.startsWith("google/")) tags.push("google");
    if (id.startsWith("openai/")) tags.push("openai");
    if (id.startsWith("anthropic/")) tags.push("anthropic");
    if (id.startsWith("meta-llama/")) tags.push("meta");

    return tags;
  }
}
