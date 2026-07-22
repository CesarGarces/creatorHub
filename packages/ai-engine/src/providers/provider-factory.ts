import { Injectable, OnModuleInit } from "@nestjs/common";
import { ProviderRegistry } from "./provider-registry";
import { OpenAIImageProvider } from "./openai.provider";
import { StabilityAIProvider } from "./stability-ai.provider";
import { FluxProvider } from "./flux.provider";
import { SiliconFlowProvider } from "./siliconflow.provider";
import { SiliconFlowVideoProvider } from "./siliconflow-video.provider";
import { MockImageProvider } from "./mock-image.provider";
import { OpenRouterProvider } from "./openrouter.provider";
import { Logger } from "@creator-hub/shared-utils";
import type { AIProviderInterface } from "./provider.interface";
import { GatewayFactory } from "../gateways/gateway-factory";

@Injectable()
export class ProviderFactory implements OnModuleInit {
  private logger = new Logger("ProviderFactory");

  constructor(
    private registry: ProviderRegistry,
    private gatewayFactory: GatewayFactory,
  ) {}

  onModuleInit() {
    this.registerBuiltInProviders();
    this.registerOpenRouterProvider();
  }

  private registerBuiltInProviders() {
    const providers: AIProviderInterface[] = [
      new OpenAIImageProvider(),
      new StabilityAIProvider(),
      new FluxProvider(),
      new SiliconFlowProvider(),
      new SiliconFlowVideoProvider(),
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

  private registerOpenRouterProvider() {
    // Register OpenRouter provider if gateway is available
    const openRouterGateway =
      this.gatewayFactory.getGatewayByType("openrouter");
    if (openRouterGateway) {
      const openRouterProvider = new OpenRouterProvider(openRouterGateway);
      this.registry.register(openRouterProvider);
      this.logger.info(
        "Provider registered: openrouter (tier: pro) - Gateway-based provider for 50+ models",
      );
    } else {
      this.logger.warn(
        "OpenRouter provider skipped: OPENROUTER_API_KEY not configured",
      );
    }
  }
}
