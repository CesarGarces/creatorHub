import { Module } from "@nestjs/common";
import { AIEngineService } from "./ai-engine.service";
import { ProviderRegistry } from "./providers/provider-registry";
import { ProviderFactory } from "./providers/provider-factory";
import { OpenRouterGateway } from "./gateways/openrouter.gateway";
import { SiliconFlowGateway } from "./gateways/siliconflow.gateway";
import { GatewayFactory } from "./gateways/gateway-factory";
import { OpenRouterModelsService } from "./models/openrouter-models.service";
import { ModelRegistryService } from "./models/model-registry.service";
import { ModelSyncService } from "./models/model-sync.service";

@Module({
  providers: [
    AIEngineService,
    ProviderRegistry,
    ProviderFactory,
    OpenRouterGateway,
    SiliconFlowGateway,
    GatewayFactory,
    OpenRouterModelsService,
    ModelRegistryService,
    ModelSyncService,
  ],
  exports: [
    AIEngineService,
    ProviderRegistry,
    ProviderFactory,
    GatewayFactory,
    OpenRouterGateway,
    SiliconFlowGateway,
    OpenRouterModelsService,
    ModelRegistryService,
    ModelSyncService,
  ],
})
export class AIEngineModule {}
