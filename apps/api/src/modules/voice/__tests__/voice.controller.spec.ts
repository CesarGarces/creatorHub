import { describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import { DEFAULT_VOICE_SETTINGS } from "@creator-hub/shared-types";
import { VoiceController } from "../voice.controller";

describe("VoiceController (GET /voice/pricing)", () => {
  it("needs a signed-in user", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, VoiceController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it("publishes the prices per minute and the voice of each language", async () => {
    const controller = new VoiceController(
      {
        get: vi.fn(async () => ({
          ...DEFAULT_VOICE_SETTINGS,
          stt: { ...DEFAULT_VOICE_SETTINGS.stt, creditsPerMinute: 30 },
          freeTier: { minutes: 10, period: "monthly" },
        })),
      } as never,
      {} as never,
    );
    const pricing = await controller.pricing();
    expect(pricing.stt).toEqual({ model: "nova-3", creditsPerMinute: 30 });
    expect(pricing.freeTier).toEqual({ minutes: 10, period: "monthly" });
    expect(pricing.tts.creditsPerMinute).toBe(120);
    expect(pricing.tts.voices.es).toMatchObject({
      model: "aura-2-celeste-es",
      name: "Celeste",
      accent: "Colombian",
    });
  });

  it("tells the user what is left of the Free plan's minutes", async () => {
    const allowance = { limited: true, remainingSeconds: 120 };
    const get = vi.fn(async () => allowance);
    const controller = new VoiceController({} as never, { get } as never);
    expect(await controller.allowance("u1")).toBe(allowance);
    expect(get).toHaveBeenCalledWith("u1");
  });
});
