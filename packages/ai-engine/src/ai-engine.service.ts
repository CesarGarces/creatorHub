import { Injectable } from "@nestjs/common";
import { ProviderRegistry } from "./providers/provider-registry";
import type { AIProviderInterface } from "./providers/provider.interface";
import type {
  AIRequest,
  AIResponse,
  AIProvider,
  AITaskType,
} from "@creator-hub/shared-types";
import { Logger } from "@creator-hub/shared-utils";
import * as Sentry from "@sentry/node";

@Injectable()
export class AIEngineService {
  private logger = new Logger("AIEngineService");

  constructor(private providerRegistry: ProviderRegistry) {}

  async execute(request: AIRequest): Promise<AIResponse> {
    const requestedProvider = request.provider;
    const providers = requestedProvider
      ? [this.providerRegistry.getProvider(requestedProvider)]
      : request.model
        ? this.findProviderByModel(request.model, request.taskType)
        : this.providerRegistry.getProvidersByTask(request.taskType);

    if (providers.length === 0) {
      const error = new Error(
        `No AI providers available for task: ${request.taskType}. Check that your API keys are configured in .env`,
      );

      Sentry.addBreadcrumb({
        type: "default",
        category: "ai.engine",
        message: `No providers available for task: ${request.taskType}`,
        level: "error",
        data: { taskType: request.taskType, toolId: request.toolId },
      });

      throw error;
    }

    // Breadcrumb: Provider selection
    Sentry.addBreadcrumb({
      type: "default",
      category: "ai.engine",
      message: `Selected ${providers.length} provider(s) for task: ${request.taskType}`,
      level: "info",
      data: {
        taskType: request.taskType,
        providers: providers.map((p) => p.name),
        toolId: request.toolId,
        requestedProvider,
        requestedModel: request.model,
      },
    });

    let lastError: Error | null = null;

    for (const provider of providers) {
      this.logger.info("Executing AI request", {
        provider: provider.name,
        taskType: request.taskType,
        toolId: request.toolId,
      });

      // Breadcrumb: Provider attempt
      Sentry.addBreadcrumb({
        type: "default",
        category: "ai.api_call",
        message: `Calling ${provider.name} API — task: ${request.taskType}`,
        level: "info",
        data: {
          provider: provider.name,
          taskType: request.taskType,
          model: request.model,
          toolId: request.toolId,
          promptLength: request.prompt?.length || 0,
        },
      });

      const startTime = Date.now();
      try {
        const response =
          request.taskType === "image-generation"
            ? await provider.generateImage({
                prompt: request.prompt,
                negativePrompt: request.negativePrompt,
                width: (request.parameters?.width as number) || 1024,
                height: (request.parameters?.height as number) || 1024,
                aspectRatio: request.parameters?.aspectRatio as string,
                model: request.model,
              })
            : await provider.generate(request);
        const latency = Date.now() - startTime;

        // Breadcrumb: Success
        Sentry.addBreadcrumb({
          type: "default",
          category: "ai.api_call",
          message: `${provider.name} responded in ${latency}ms`,
          level: "info",
          data: {
            provider: provider.name,
            latency,
            taskType: request.taskType,
            tokensUsed: response.usage?.tokens || 0,
          },
        });

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

        // Breadcrumb: Provider failure
        Sentry.addBreadcrumb({
          type: "default",
          category: "ai.api_call",
          message: `${provider.name} failed after ${latency}ms: ${message}`,
          level: "error",
          data: {
            provider: provider.name,
            error: message,
            latency,
            taskType: request.taskType,
          },
        });

        const isRetryable =
          message.includes("billing") ||
          message.includes("rate limit") ||
          message.includes("quota") ||
          message.includes("insufficient") ||
          message.includes("limit") ||
          message.includes("404") ||
          message.includes("not found") ||
          message.includes("does not exist");

        if (isRetryable && providers.length > 1) {
          this.logger.info("Retrying with next available provider", {
            failedProvider: provider.name,
          });

          // Breadcrumb: Retry
          Sentry.addBreadcrumb({
            type: "default",
            category: "ai.engine",
            message: `Retrying with next provider (failed: ${provider.name})`,
            level: "warning",
            data: {
              failedProvider: provider.name,
              reason: "retryable_error",
            },
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
      aspectRatio?: string;
      userId?: string;
      toolId?: string;
      imageUrl?: string;
    },
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
        aspectRatio: options.aspectRatio,
        imageUrl: options.imageUrl,
      },
      userId: options.userId,
      toolId: options.toolId,
    });
  }

  private findProviderByModel(
    model: string,
    taskType: AITaskType,
  ): AIProviderInterface[] {
    const allForTask = this.providerRegistry.getProvidersByTask(taskType);
    const match = allForTask.find((p) => p.supportedModels.includes(model));
    return match ? [match] : allForTask;
  }
}
