import { describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { BadGatewayException, BadRequestException } from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { DEFAULT_VOICE_SETTINGS } from "@creator-hub/shared-types";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  AdminVoiceSettingsController,
  VOICE_PREVIEW_TEXT,
} from "../admin-voice-settings.controller";
import { AdminGuard } from "../admin.guard";

function setup() {
  const voiceSettings = {
    get: vi.fn(async () => DEFAULT_VOICE_SETTINGS),
    update: vi.fn(async () => ({
      ...DEFAULT_VOICE_SETTINGS,
      updatedAt: "2026-11-29T10:00:00.000Z",
    })),
  };
  const tts = {
    activeProvider: vi.fn(() => "deepgram"),
    synthesize: vi.fn(async (p: { voice?: string }) => ({
      audio: Buffer.from("mp3"),
      mimeType: "audio/mpeg",
      durationMs: 2100,
      voice: p.voice,
      provider: "deepgram",
    })),
  };
  const controller = new AdminVoiceSettingsController(
    voiceSettings as never,
    tts as never,
  );
  return { controller, voiceSettings, tts };
}

const body = {
  sttModel: "nova-3",
  sttCreditsPerSecond: 1,
  ttsCreditsPerSecond: 2,
  ttsVoices: DEFAULT_VOICE_SETTINGS.tts.voices,
  freeTierMinutes: 10,
  freeTierPeriod: "monthly" as const,
};

describe("AdminVoiceSettingsController", () => {
  it("is admin only", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminVoiceSettingsController),
    ).toEqual([JwtAuthGuard, AdminGuard]);
  });

  it("returns the settings and who speaks", async () => {
    const { controller } = setup();
    expect(await controller.get()).toEqual({
      settings: DEFAULT_VOICE_SETTINGS,
      ttsProvider: "deepgram",
    });
  });

  it("saves with the acting admin", async () => {
    const { controller, voiceSettings } = setup();
    const saved = await controller.update(body, { id: "admin-1" });
    expect(voiceSettings.update).toHaveBeenCalledWith(body, "admin-1");
    expect(saved.settings.updatedAt).toBe("2026-11-29T10:00:00.000Z");
  });

  it("plays a voice sample in its language (base64 audio)", async () => {
    const { controller, tts } = setup();
    const sample = await controller.preview({
      language: "es",
      voice: "aura-2-javier-es",
    });
    expect(tts.synthesize).toHaveBeenCalledWith({
      text: VOICE_PREVIEW_TEXT.es,
      language: "es",
      voice: "aura-2-javier-es",
    });
    expect(sample).toEqual({
      voice: "aura-2-javier-es",
      mimeType: "audio/mpeg",
      durationMs: 2100,
      data: Buffer.from("mp3").toString("base64"),
    });
  });

  it("refuses a voice of another language and explains Deepgram errors", async () => {
    const { controller, tts } = setup();
    await expect(
      controller.preview({ language: "pt", voice: "aura-2-celeste-es" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tts.synthesize).not.toHaveBeenCalled();

    tts.synthesize.mockRejectedValueOnce(
      new Error("Deepgram TTS error 400: model not found"),
    );
    const error = await controller
      .preview({ language: "pt", voice: "flux-bruno-pt" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect((error as Error).message).toContain("model not found");
  });
});
