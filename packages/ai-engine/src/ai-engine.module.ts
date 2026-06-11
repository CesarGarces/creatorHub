import { Module } from "@nestjs/common";
import { AIEngineService } from "./ai-engine.service";
import { ProviderRegistry } from "./providers/provider-registry";
import { ProviderFactory } from "./providers/provider-factory";

@Module({
  providers: [AIEngineService, ProviderRegistry, ProviderFactory],
  exports: [AIEngineService, ProviderRegistry, ProviderFactory],
})
export class AIEngineModule {}
