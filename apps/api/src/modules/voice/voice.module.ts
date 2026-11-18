import { Module } from "@nestjs/common";
import { VoiceSettingsModule } from "@creator-hub/voice-settings";
import { VoiceController } from "./voice.controller";

/** `GET /voice/pricing` — see VoiceController. */
@Module({
  imports: [VoiceSettingsModule],
  controllers: [VoiceController],
})
export class VoiceModule {}
