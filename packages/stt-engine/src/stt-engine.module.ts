import { Module } from "@nestjs/common";
import { STTEngineService } from "./stt-engine.service";
import { STTSessionManager } from "./stt-session.manager";
import { STTProviderRegistry } from "./providers/stt-provider.registry";
import { STTProviderFactory } from "./providers/stt-provider.factory";

@Module({
  providers: [
    STTEngineService,
    STTSessionManager,
    STTProviderRegistry,
    STTProviderFactory,
  ],
  exports: [STTEngineService, STTSessionManager, STTProviderRegistry],
})
export class STTEngineModule {}
