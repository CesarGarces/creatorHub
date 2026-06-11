import { Injectable, OnModuleInit } from "@nestjs/common";
import { ProviderRegistry } from "./provider-registry";
import { OpenAIImageProvider } from "./openai.provider";
import { GeminiProvider } from "./gemini.provider";
import { StabilityAIProvider } from "./stability-ai.provider";
import { FluxProvider } from "./flux.provider";
import { NanoBananaProvider } from "./nano-banana.provider";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class ProviderFactory implements OnModuleInit {
  private logger = new Logger("ProviderFactory");

  constructor(private registry: ProviderRegistry) {}

  onModuleInit() {
    this.registerBuiltInProviders();
  }

  private registerBuiltInProviders() {
    const providers = [
      new OpenAIImageProvider(),
      new GeminiProvider(),
      new StabilityAIProvider(),
      new FluxProvider(),
      new NanoBananaProvider(),
    ];

    for (const provider of providers) {
      if (provider.validateConfig()) {
        this.registry.register(provider);
        this.logger.info(`Provider registered: ${provider.name}`);
      }
    }
  }
}
