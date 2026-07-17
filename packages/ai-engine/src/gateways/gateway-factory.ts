import { Injectable } from "@nestjs/common";
import { Logger } from "@creator-hub/shared-utils";
import type { AIGatewayInterface, GatewayType } from "./ai-gateway.interface";
import { OpenRouterGateway } from "./openrouter.gateway";
import { SiliconFlowGateway } from "./siliconflow.gateway";

/**
 * GatewayFactory resolves the appropriate AI gateway based on provider slug.
 *
 * Usage:
 *   const gateway = gatewayFactory.getGateway("openrouter");
 *   const response = await gateway.chatCompletion({ model, messages });
 */
@Injectable()
export class GatewayFactory {
  private logger = new Logger("GatewayFactory");
  private gateways = new Map<GatewayType, AIGatewayInterface>();
  private providerToGateway = new Map<string, GatewayType>();

  constructor(
    private openRouterGateway: OpenRouterGateway,
    private siliconFlowGateway: SiliconFlowGateway,
  ) {
    this.registerGateways();
    this.registerProviderMappings();
  }

  private registerGateways(): void {
    const allGateways: AIGatewayInterface[] = [
      this.openRouterGateway,
      this.siliconFlowGateway,
    ];

    for (const gateway of allGateways) {
      if (gateway.validateConfig()) {
        this.gateways.set(gateway.type, gateway);
        this.logger.info(`Gateway registered: ${gateway.type}`);
      } else {
        this.logger.warn(`Gateway skipped (no API key): ${gateway.type}`);
      }
    }
  }

  private registerProviderMappings(): void {
    // Map provider slugs to gateway types
    // OpenRouter providers
    this.providerToGateway.set("openrouter", "openrouter");

    // SiliconFlow providers
    this.providerToGateway.set("siliconflow", "siliconflow");
    this.providerToGateway.set("siliconflow-video", "siliconflow");
    this.providerToGateway.set("z-image-turbo", "siliconflow");
    this.providerToGateway.set("deepseek-v4", "siliconflow");
    this.providerToGateway.set("deepseek-v4-pro", "siliconflow");
    this.providerToGateway.set("glm5", "siliconflow");
  }

  /**
   * Get gateway by type
   */
  getGatewayByType(type: GatewayType): AIGatewayInterface | undefined {
    return this.gateways.get(type);
  }

  /**
   * Get gateway for a provider slug
   */
  getGatewayForProvider(providerSlug: string): AIGatewayInterface | undefined {
    const gatewayType = this.providerToGateway.get(providerSlug);
    if (!gatewayType) {
      this.logger.warn(`No gateway mapping for provider: ${providerSlug}`);
      return undefined;
    }
    return this.gateways.get(gatewayType);
  }

  /**
   * Get gateway for a model ID
   * OpenRouter models use format "provider/model-name"
   * SiliconFlow models use format "Provider/Model-Name"
   */
  getGatewayForModel(modelId: string): AIGatewayInterface | undefined {
    // Check if it's an OpenRouter model (contains / and is in known OpenRouter format)
    if (modelId.includes("/") && this.isOpenRouterModel(modelId)) {
      return this.gateways.get("openrouter");
    }

    // Check SiliconFlow models
    if (this.isSiliconFlowModel(modelId)) {
      return this.gateways.get("siliconflow");
    }

    // Default to OpenRouter if available
    return this.gateways.get("openrouter") || this.gateways.get("siliconflow");
  }

  private isOpenRouterModel(modelId: string): boolean {
    const openRouterPrefixes = [
      "google/",
      "openai/",
      "anthropic/",
      "meta-llama/",
      "mistralai/",
      "cohere/",
      "nvidia/",
      "perplexity/",
      "amazon/",
      "microsoft/",
      "deepseek/",
      "qwen/",
      "nousresearch/",
      "cognitivecomputations/",
      "liquid/",
      "phind/",
      "deepgram/",
      "runway/",
      "stability/",
    ];

    return openRouterPrefixes.some((prefix) =>
      modelId.toLowerCase().startsWith(prefix),
    );
  }

  private isSiliconFlowModel(modelId: string): boolean {
    const siliconFlowModels = [
      "black-forest-labs/",
      "Tongyi-MAI/",
      "deepseek-ai/",
      "zai-org/",
      "Wan-AI/",
      "Qwen/",
    ];

    return siliconFlowModels.some((prefix) => modelId.startsWith(prefix));
  }

  /**
   * Get all available gateways
   */
  getAvailableGateways(): AIGatewayInterface[] {
    return Array.from(this.gateways.values());
  }

  /**
   * Check if a gateway is available
   */
  isGatewayAvailable(type: GatewayType): boolean {
    return this.gateways.has(type);
  }

  /**
   * Register a custom gateway (for testing or extensions)
   */
  registerGateway(gateway: AIGatewayInterface): void {
    if (gateway.validateConfig()) {
      this.gateways.set(gateway.type, gateway);
      this.logger.info(`Custom gateway registered: ${gateway.type}`);
    }
  }

  /**
   * Register provider-to-gateway mapping
   */
  registerProviderMapping(
    providerSlug: string,
    gatewayType: GatewayType,
  ): void {
    this.providerToGateway.set(providerSlug, gatewayType);
  }
}
