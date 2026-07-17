import { AIProviderBase } from "./ai-provider.base";
import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
  AIStreamChunk,
} from "@creator-hub/shared-types";
import type { ImageGenerationOptions } from "./provider.interface";
import type { AIGatewayInterface } from "../gateways/ai-gateway.interface";

/**
 * OpenRouterProvider - Generic provider for all OpenRouter models.
 *
 * This provider handles:
 * - Chat/text generation (all OpenRouter chat models)
 * - Image generation (Flux, DALL-E, Stable Diffusion, etc.)
 * - Streaming responses
 *
 * The model ID is passed dynamically, not hardcoded.
 * Example model IDs:
 * - "google/gemini-3.1-flash-image"
 * - "openai/gpt-image-1-mini"
 * - "anthropic/claude-3.5-sonnet"
 * - "meta-llama/llama-3.1-405b-instruct"
 */
export class OpenRouterProvider extends AIProviderBase {
  readonly name: AIProvider = "openrouter" as AIProvider;
  readonly supportedTasks: AITaskType[] = [
    "image-generation",
    "image-editing",
    "text-generation",
    "text-analysis",
    "video-generation",
  ];
  readonly supportedModels: string[] = []; // Dynamic - managed by ModelRegistry
  readonly tier = "pro" as const;

  private gateway: AIGatewayInterface | undefined;

  constructor(gateway?: AIGatewayInterface) {
    super();
    this.gateway = gateway;
  }

  /**
   * Set the gateway (called by ProviderFactory after construction)
   */
  setGateway(gateway: AIGatewayInterface): void {
    this.gateway = gateway;
  }

  /**
   * Get the model to use for this request
   * Falls back to a default model if not specified
   */
  private getModel(request: AIRequest | ImageGenerationOptions): string {
    const model =
      "model" in request
        ? request.model
        : (request as ImageGenerationOptions).model;
    return model || "google/gemini-2.5-flash"; // Default fallback
  }

  // ──────────────────────────────────────────────
  // TEXT GENERATION
  // ──────────────────────────────────────────────

  async generate(request: AIRequest): Promise<AIResponse> {
    if (!this.gateway) {
      throw new Error("OpenRouter gateway not configured");
    }

    const model = this.getModel(request);
    const startTime = Date.now();

    // Build messages array
    const messages = this.buildMessages(request);

    const response = await this.gateway.chatCompletion({
      model,
      messages,
      temperature: (request.parameters?.temperature as number) || 0.7,
      maxTokens: (request.parameters?.maxTokens as number) || 4096,
    });

    const latency = Date.now() - startTime;

    return {
      id: response.id,
      provider: this.name,
      model: response.model,
      output: {
        type: "text",
        content: response.content || "",
      },
      usage: {
        credits: 1, // Will be overridden by credit service
        tokens: response.usage?.totalTokens,
      },
      latency,
      metadata: {
        finishReason: response.finishReason,
        promptTokens: response.usage?.promptTokens,
        completionTokens: response.usage?.completionTokens,
      },
    };
  }

  // ──────────────────────────────────────────────
  // IMAGE GENERATION
  // ──────────────────────────────────────────────

  async generateImage(options: ImageGenerationOptions): Promise<AIResponse> {
    if (!this.gateway) {
      throw new Error("OpenRouter gateway not configured");
    }

    const model = options.model || "openai/gpt-image-1-mini";
    const startTime = Date.now();

    const response = await this.gateway.imageGeneration({
      model,
      prompt: options.prompt,
      negativePrompt: options.negativePrompt,
      width: options.width || 1024,
      height: options.height || 1024,
      imageUrl: options.imageUrl,
    });

    const latency = Date.now() - startTime;

    return {
      id: response.id,
      provider: this.name,
      model: response.model,
      output: {
        type: "image",
        url: response.imageUrl || "",
        width: options.width || 1024,
        height: options.height || 1024,
      },
      usage: {
        credits: 1, // Will be overridden by credit service
        tokens: response.usage?.totalTokens,
        images: 1,
      },
      latency,
      metadata: {
        finishReason: response.finishReason,
      },
    };
  }

  // ──────────────────────────────────────────────
  // STREAMING
  // ──────────────────────────────────────────────

  async *generateStream(request: AIRequest): AsyncGenerator<AIStreamChunk> {
    if (!this.gateway) {
      throw new Error("OpenRouter gateway not configured");
    }

    const model = this.getModel(request);
    const messages = this.buildMessages(request);

    const stream = this.gateway.chatCompletionStream({
      model,
      messages,
      temperature: (request.parameters?.temperature as number) || 0.7,
      maxTokens: (request.parameters?.maxTokens as number) || 4096,
    });

    for await (const { chunk, done, usage } of stream) {
      if (done) {
        yield {
          type: "done",
          usage: usage
            ? {
                credits: 1,
                tokens: usage.totalTokens,
              }
            : undefined,
        };
        return;
      }

      if (chunk) {
        yield {
          type: "content",
          content: chunk,
        };
      }
    }
  }

  // ──────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────

  private buildMessages(
    request: AIRequest,
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt if provided
    if (request.parameters?.systemPrompt) {
      messages.push({
        role: "system",
        content: request.parameters.systemPrompt as string,
      });
    }

    // Add conversation history if provided
    if (request.parameters?.history) {
      const history = request.parameters.history as Array<{
        role: string;
        content: string;
      }>;
      messages.push(...history);
    }

    // Add current user message
    messages.push({
      role: "user",
      content: request.prompt,
    });

    return messages;
  }

  protected getApiKeyEnvVar(): string | null {
    return "OPENROUTER_API_KEY";
  }
}
