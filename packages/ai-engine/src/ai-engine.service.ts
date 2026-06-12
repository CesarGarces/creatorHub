import { Injectable } from "@nestjs/common";
import { ProviderRegistry } from "./providers/provider-registry";
import type { AIRequest, AIResponse, AIProvider } from "@creator-hub/shared-types";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class AIEngineService {
  private logger = new Logger("AIEngineService");

  constructor(private providerRegistry: ProviderRegistry) {}

  async execute(request: AIRequest): Promise<AIResponse> {
    const provider = request.provider || (await this.selectOptimalProvider(request));
    const instance = this.providerRegistry.getProvider(provider);

    this.logger.info("Executing AI request", {
      provider,
      taskType: request.taskType,
      toolId: request.toolId,
    });

    const startTime = Date.now();
    try {
      const response = request.taskType === "image-generation"
        ? await instance.generateImage({
            prompt: request.prompt,
            negativePrompt: request.negativePrompt,
            width: (request.parameters?.width as number) || 1024,
            height: (request.parameters?.height as number) || 1024,
          })
        : await instance.generate(request);
      const latency = Date.now() - startTime;

      return {
        ...response,
        provider,
        latency,
      };
    } catch (error) {
      this.logger.error("AI request failed", {
        provider,
        error: (error as Error).message,
      });
      throw error;
    }
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

  private async selectOptimalProvider(request: AIRequest): Promise<AIProvider> {
    const providers = this.providerRegistry.getProvidersByTask(request.taskType);
    if (providers.length === 0) {
      throw new Error(
        `No AI providers available for task: ${request.taskType}. Check that your API keys are configured in .env`
      );
    }
    return providers[0]!.name;
  }
}
