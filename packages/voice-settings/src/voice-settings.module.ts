import { Module } from "@nestjs/common";
import { VoiceAllowanceService } from "./voice-allowance.service";
import { VoiceSettingsService } from "./voice-settings.service";

/**
 * Voice settings (Admin → Voice: STT & TTS) and the Free plan's minutes
 * with Robotina. Imported by the STT gateway, the admin panel, the public
 * voice endpoints and Robotina.
 */
@Module({
  providers: [VoiceSettingsService, VoiceAllowanceService],
  exports: [VoiceSettingsService, VoiceAllowanceService],
})
export class VoiceSettingsModule {}
