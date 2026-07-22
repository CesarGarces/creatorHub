import type {
  AIRequest,
  AIResponse,
  AIStreamChunk,
  AITaskType,
} from "@creator-hub/shared-types";

// ──────────────────────────────────────────────
// GATEWAY TYPES
// ──────────────────────────────────────────────

export type GatewayType = "openrouter" | "siliconflow" | "openai" | "gemini";

export interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

// ──────────────────────────────────────────────
// RATE LIMIT INFO
// ──────────────────────────────────────────────

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: number; // Unix timestamp in seconds
}

// ──────────────────────────────────────────────
// MODEL INFO (from provider API)
// ──────────────────────────────────────────────

export interface ModelInfo {
  id: string; // e.g. "google/gemini-3.1-flash-image"
  name: string; // Display name
  taskType: AITaskType;
  contextLength?: number;
  maxOutputTokens?: number;
  supportsStreaming: boolean;
  supportsVision: boolean;
  pricing: {
    promptPer1k?: number; // USD per 1K tokens
    completionPer1k?: number;
    imagePerGen?: number;
  };
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  description?: string;
  tags?: string[];
}

// ──────────────────────────────────────────────
// GATEWAY RESPONSE
// ──────────────────────────────────────────────

export interface GatewayResponse {
  id: string;
  model: string;
  content?: string;
  imageUrl?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  rateLimit?: RateLimitInfo;
  rawResponse?: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// GATEWAY INTERFACE (Contract)
// ──────────────────────────────────────────────

export interface AIGatewayInterface {
  readonly type: GatewayType;
  readonly baseUrl: string;

  /**
   * Validate that the gateway is properly configured
   */
  validateConfig(): boolean;

  /**
   * Send a chat/completion request
   */
  chatCompletion(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
  }): Promise<GatewayResponse>;

  /**
   * Stream a chat/completion request
   */
  chatCompletionStream(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<{
    chunk: string;
    done: boolean;
    usage?: GatewayResponse["usage"];
  }>;

  /**
   * Generate an image
   */
  imageGeneration(params: {
    model: string;
    prompt: string;
    negativePrompt?: string;
    width?: number;
    height?: number;
    imageUrl?: string; // For image-to-image
  }): Promise<GatewayResponse>;

  /**
   * Generate a video
   * Optional method - not all gateways support video generation
   */
  videoGeneration?(params: {
    model: string;
    prompt: string;
    width?: number;
    height?: number;
    imageUrl?: string; // For image-to-video
    duration?: number; // Duration in seconds
    audioEnabled?: boolean; // Enable/disable audio
    quality?: string; // Resolution quality (480p, 720p, 1080p, 4k)
  }): Promise<GatewayResponse>;

  /**
   * List available models from the provider
   */
  listModels(): Promise<ModelInfo[]>;

  /**
   * Get model info by ID
   */
  getModel(modelId: string): Promise<ModelInfo | null>;

  /**
   * Get rate limit info for a model
   */
  getRateLimit(modelId: string): Promise<RateLimitInfo | null>;
}
