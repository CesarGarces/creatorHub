import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { AnalyticsModule } from "@creator-hub/analytics";
import { BillingModule } from "@creator-hub/billing";
import { TTSEngineModule } from "@creator-hub/tts-engine";
import { VoiceSettingsModule } from "@creator-hub/voice-settings";
import { VoiceAssistantController } from "./voice-assistant.controller";
import { VoiceAssistantService } from "./voice-assistant.service";

/**
 * Robotina — AI voice assistant. Voice input reuses the platform's STT
 * gateway (WebSocket `stt:*`, billed per second); this module turns the
 * transcript into a reply (any active text model) spoken with Deepgram
 * Aura (TTSEngineModule) in the voice set for its language in Admin →
 * Voice (VoiceSettingsModule). ToolRegistry comes from the global
 * ToolSdkModule. No storage: audio is streamed, never saved.
 */
@Module({
  imports: [
    AIEngineModule,
    BillingModule,
    AnalyticsModule,
    TTSEngineModule,
    VoiceSettingsModule,
  ],
  controllers: [VoiceAssistantController],
  providers: [VoiceAssistantService],
  exports: [VoiceAssistantService],
})
export class VoiceAssistantModule {}
