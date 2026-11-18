import { Module } from "@nestjs/common";
import { TTSEngineService } from "./tts-engine.service";
import { TTSProviderRegistry } from "./providers/tts-provider.registry";
import { TTSProviderFactory } from "./providers/tts-provider.factory";

@Module({
  providers: [TTSEngineService, TTSProviderRegistry, TTSProviderFactory],
  exports: [TTSEngineService, TTSProviderRegistry],
})
export class TTSEngineModule {}
