export type ProviderTier = "free" | "pro";

export type AIProvider =
  | "openai"
  | "gemini"
  | "flux"
  | "stability-ai"
  | "ideogram"
  | "siliconflow"
  | "siliconflow-video"
  | "z-image-turbo"
  | "deepseek-v4"
  | "deepseek-v4-pro"
  | "mock";

export type AIModel =
  | "flux-dev"
  | "flux-pro"
  | "flux-1-schnell"
  | "stable-diffusion-3"
  | "dall-e-3"
  | "gpt-image-1"
  | "gemini-pro-vision"
  | "ideogram-v2"
  | "gemini-2.5-flash"
  | "gemini-2.5-flash-image"
  | "Z-Image-Turbo"
  | "deepseek-ai/DeepSeek-V4-Flash"
  | "deepseek-ai/DeepSeek-V4-Pro"
  | "Wan-AI/Wan2.2-T2V-A14B"
  | "Wan-AI/Wan2.2-I2V-A14B";

export type AITaskType =
  | "image-generation"
  | "image-editing"
  | "image-variation"
  | "text-generation"
  | "text-analysis"
  | "trend-analysis"
  | "speech-to-text"
  | "video-generation";

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
  | { type: "json"; data: Record<string, unknown> }
  | {
      type: "video";
      url: string;
      width: number;
      height: number;
      duration?: number;
    };

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
