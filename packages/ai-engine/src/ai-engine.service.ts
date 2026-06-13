import { Injectable } from "@nestjs/common";
import { ProviderRegistry } from "./providers/provider-registry";
import type { AIRequest, AIResponse, AIProvider } from "@creator-hub/shared-types";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class AIEngineService {
  private logger = new Logger("AIEngineService");

  constructor(private providerRegistry: ProviderRegistry) {}

  async execute(request: AIRequest): Promise<AIResponse> {
    const requestedProvider = request.provider;
    const providers = requestedProvider
      ? [this.providerRegistry.getProvider(requestedProvider)]
      : this.providerRegistry.getProvidersByTask(request.taskType);

    if (providers.length === 0) {
      throw new Error(
        `No AI providers available for task: ${request.taskType}. Check that your API keys are configured in .env`
      );
    }

    let lastError: Error | null = null;

    for (const provider of providers) {
      this.logger.info("Executing AI request", {
        provider: provider.name,
        taskType: request.taskType,
        toolId: request.toolId,
      });

      const startTime = Date.now();
      try {
        const response = request.taskType === "image-generation"
          ? await provider.generateImage({
              prompt: request.prompt,
              negativePrompt: request.negativePrompt,
              width: (request.parameters?.width as number) || 1024,
              height: (request.parameters?.height as number) || 1024,
              model: request.model,
            })
          : await provider.generate(request);
        const latency = Date.now() - startTime;

        return {
          ...response,
          provider: provider.name,
          latency,
        };
      } catch (error) {
        const latency = Date.now() - startTime;
        lastError = error as Error;
        const message = (error as Error).message || "";

        this.logger.error("AI provider failed", {
          provider: provider.name,
          error: message,
          latency,
        });

        const isRetryable =
          message.includes("billing") ||
          message.includes("rate limit") ||
          message.includes("quota") ||
          message.includes("insufficient") ||
          message.includes("limit");

        if (isRetryable && providers.length > 1) {
          this.logger.info("Retrying with next available provider", {
            failedProvider: provider.name,
          });
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error("All AI providers failed");
  }

  async generateImage(
    prompt: string,
    options: {
      provider?: AIProvider;
      model?: string;
      negativePrompt?: string;
      width?: number;
      height?: number;
      userId?: string;
      toolId?: string;
    }
  ): Promise<AIResponse> {
    return this.execute({
      taskType: "image-generation",
      provider: options.provider,
      model: options.model as any,
      prompt,
      negativePrompt: options.negativePrompt,
      parameters: {
        width: options.width || 1024,
        height: options.height || 1024,
      },
      userId: options.userId,
      toolId: options.toolId,
    });
  }

}
