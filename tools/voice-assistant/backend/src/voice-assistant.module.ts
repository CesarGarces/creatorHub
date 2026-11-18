import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { AnalyticsModule } from "@creator-hub/analytics";
import { BillingModule } from "@creator-hub/billing";
import { TTSEngineModule } from "@creator-hub/tts-engine";
import { VoiceAssistantController } from "./voice-assistant.controller";
import { VoiceAssistantService } from "./voice-assistant.service";

/**
 * Robotina — AI voice assistant. Voice input reuses the platform's STT
 * gateway (WebSocket `stt:*`, billed per minute); this module turns the
 * transcript into a reply (any active text model) spoken with Deepgram
 * Aura-2 (TTSEngineModule). ToolRegistry comes from the global
 * ToolSdkModule. No storage: audio is streamed, never saved.
 */
@Module({
  imports: [AIEngineModule, BillingModule, AnalyticsModule, TTSEngineModule],
  controllers: [VoiceAssistantController],
  providers: [VoiceAssistantService],
  exports: [VoiceAssistantService],
})
export class VoiceAssistantModule {}
