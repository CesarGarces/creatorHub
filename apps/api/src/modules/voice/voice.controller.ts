import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import {
  VoiceAllowanceService,
  VoiceSettingsService,
} from "@creator-hub/voice-settings";
import {
  voicePricingFrom,
  type VoiceAllowance,
  type VoicePricing,
} from "@creator-hub/shared-types";

/**
 * Voice prices and voices for the web app (Admin → Voice: STT & TTS):
 * credits per minute of voice input (every voice button) and of
 * Robotina's speech, who speaks each language, the Free plan's minutes
 * with Robotina — and what the signed-in user has left of them.
 */
@Controller("voice")
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(
    private readonly voiceSettings: VoiceSettingsService,
    private readonly voiceAllowance: VoiceAllowanceService,
  ) {}

  @Get("pricing")
  async pricing(): Promise<VoicePricing> {
    return voicePricingFrom(await this.voiceSettings.get());
  }

  @Get("allowance")
  async allowance(@CurrentUser("id") userId: string): Promise<VoiceAllowance> {
    return this.voiceAllowance.get(userId);
  }
}
