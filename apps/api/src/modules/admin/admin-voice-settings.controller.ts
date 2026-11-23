import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser, JwtAuthGuard } from "@creator-hub/auth";
import { TTSEngineService } from "@creator-hub/tts-engine";
import { VoiceSettingsService } from "@creator-hub/voice-settings";
import {
  TTS_MODEL_OPTIONS,
  isTTSVoiceId,
  type TTSLanguage,
  type TTSProviderName,
  type VoiceSettings,
} from "@creator-hub/shared-types";
import { AdminGuard } from "./admin.guard";
import {
  PreviewVoiceDto,
  UpdateVoiceSettingsDto,
} from "./dto/voice-settings.dto";

/** What the admin hears when trying a voice (in its language). */
export const VOICE_PREVIEW_TEXT: Record<TTSLanguage, string> = {
  en: "Hi! I'm Robotina. This is how I sound when I answer you.",
  es: "¡Hola! Soy Robotina. Así sueno cuando te respondo.",
  pt: "Olá! Eu sou a Robotina. É assim que eu soo quando te respondo.",
};

export interface AdminVoiceSettingsResponse {
  settings: VoiceSettings;
  /** Who speaks right now: Deepgram (key set), the dev mock, or nobody. */
  ttsProvider: TTSProviderName | null;
}

/**
 * Admin → Voice (STT & TTS): the Deepgram speech-to-text model, the Deepgram
 * voice of each language and the prices per minute.
 */
@Controller("admin/voice-settings")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminVoiceSettingsController {
  constructor(
    private readonly voiceSettings: VoiceSettingsService,
    private readonly tts: TTSEngineService,
  ) {}

  @Get()
  async get(): Promise<AdminVoiceSettingsResponse> {
    return {
      settings: await this.voiceSettings.get(),
      ttsProvider: this.tts.activeProvider(),
    };
  }

  @Put()
  async update(
    @Body() body: UpdateVoiceSettingsDto,
    @CurrentUser() admin: { id: string },
  ): Promise<AdminVoiceSettingsResponse> {
    return {
      settings: await this.voiceSettings.update(body, admin?.id),
      ttsProvider: this.tts.activeProvider(),
    };
  }

  /** Speaks a sample with a voice (not saved, not billed). */
  @Post("preview")
  async preview(@Body() body: PreviewVoiceDto) {
    const known = TTS_MODEL_OPTIONS.some((model) =>
      isTTSVoiceId(model.id, body.voice, body.language),
    );
    if (!known) {
      throw new BadRequestException("This voice doesn't speak that language");
    }
    let audio;
    try {
      audio = await this.tts.synthesize({
        text: body.text?.trim() || VOICE_PREVIEW_TEXT[body.language],
        language: body.language,
        voice: body.voice,
      });
    } catch (error) {
      // e.g. "Deepgram TTS error 400: …" for a voice Deepgram doesn't have.
      throw new BadGatewayException(
        `The voice couldn't be played: ${(error as Error).message}`,
      );
    }
    return {
      voice: audio.voice,
      mimeType: audio.mimeType,
      durationMs: audio.durationMs,
      data: audio.audio.toString("base64"),
    };
  }
}
