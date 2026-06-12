export type AIProvider =
  | "openai"
  | "gemini"
  | "flux"
  | "stability-ai"
  | "ideogram";

export type AIModel =
  | "flux-dev"
  | "flux-pro"
  | "stable-diffusion-3"
  | "dall-e-3"
  | "gpt-image-1"
  | "gemini-pro-vision"
  | "ideogram-v2"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-image";

export type AITaskType =
  | "image-generation"
  | "image-editing"
  | "image-variation"
  | "text-generation"
  | "text-analysis"
  | "trend-analysis";

export interface AIRequest {
  taskType: AITaskType;
  provider?: AIProvider;
  model?: AIModel;
  prompt: string;
  negativePrompt?: string;
  parameters?: Record<string, unknown>;
  userId?: string;
  toolId?: string;
}

export interface AIResponse {
  id: string;
  provider: AIProvider;
  model: string;
  output: AIOutput;
  usage: AIUsage;
  latency: number;
  metadata?: Record<string, unknown>;
}

export type AIOutput =
  | { type: "image"; url: string; width: number; height: number }
  | { type: "text"; content: string }
  | { type: "json"; data: Record<string, unknown> };

export interface AIUsage {
  credits: number;
  tokens?: number;
  images?: number;
  duration?: number;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  options?: Record<string, unknown>;
}
