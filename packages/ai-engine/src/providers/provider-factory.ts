import { Injectable, OnModuleInit } from "@nestjs/common";
import { ProviderRegistry } from "./provider-registry";
import { OpenAIImageProvider } from "./openai.provider";
import { GeminiProvider } from "./gemini.provider";
import { StabilityAIProvider } from "./stability-ai.provider";
import { FluxProvider } from "./flux.provider";
import { SiliconFlowProvider } from "./siliconflow.provider";
import { SiliconFlowVideoProvider } from "./siliconflow-video.provider";
import { ZImageTurboProvider } from "./z-image-turbo.provider";
import {
  DeepSeekV4FlashProvider,
  DeepSeekV4ProProvider,
} from "./deepseek-v4.provider";
import { GLM5Provider } from "./glm5.provider";
import { MockImageProvider } from "./mock-image.provider";
import { Logger } from "@creator-hub/shared-utils";
import type { AIProviderInterface } from "./provider.interface";

@Injectable()
export class ProviderFactory implements OnModuleInit {
  private logger = new Logger("ProviderFactory");

  constructor(private registry: ProviderRegistry) {}

  onModuleInit() {
    this.registerBuiltInProviders();
  }

  private registerBuiltInProviders() {
    const providers: AIProviderInterface[] = [
      new OpenAIImageProvider(),
      new GeminiProvider(),
      new StabilityAIProvider(),
      new FluxProvider(),
      new SiliconFlowProvider(),
      new SiliconFlowVideoProvider(),
      new ZImageTurboProvider(),
      new DeepSeekV4FlashProvider(),
      new DeepSeekV4ProProvider(),
      new GLM5Provider(),
    ];

    // In development without SiliconFlow key, register mock as fallback
    if (!process.env.SILICONFLOW_API_KEY) {
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test"
      ) {
        providers.push(new MockImageProvider());
      }
    }

    for (const provider of providers) {
      if (provider.validateConfig()) {
        this.registry.register(provider);
        this.logger.info(
          `Provider registered: ${provider.name} (tier: ${provider.tier || "pro"})`,
        );
      }
    }
  }
}
