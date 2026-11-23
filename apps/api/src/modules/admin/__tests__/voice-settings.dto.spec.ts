import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DEFAULT_TTS_LANGUAGE_VOICES } from "@creator-hub/shared-types";
import {
  PreviewVoiceDto,
  UpdateVoiceSettingsDto,
} from "../dto/voice-settings.dto";

const errorsFor = async (cls: new () => object, body: object) =>
  (
    await validate(plainToInstance(cls, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  ).map((e) => e.property);

const valid = {
  sttModel: "nova-3",
  sttCreditsPerMinute: 60,
  ttsCreditsPerMinute: 120,
  ttsVoices: DEFAULT_TTS_LANGUAGE_VOICES,
  freeTierMinutes: 10,
  freeTierPeriod: "monthly",
};

describe("UpdateVoiceSettingsDto", () => {
  it("accepts the settings, with or without a Free plan limit", async () => {
    expect(await errorsFor(UpdateVoiceSettingsDto, valid)).toEqual([]);
    expect(
      await errorsFor(UpdateVoiceSettingsDto, {
        ...valid,
        freeTierMinutes: null,
        freeTierPeriod: "lifetime",
      }),
    ).toEqual([]);
  });

  it("rejects bad shapes and extra fields", async () => {
    expect(
      await errorsFor(UpdateVoiceSettingsDto, {
        ...valid,
        sttCreditsPerMinute: "60",
        freeTierMinutes: 2.5,
        freeTierPeriod: "weekly",
        extra: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        "sttCreditsPerMinute",
        "freeTierMinutes",
        "freeTierPeriod",
        "extra",
      ]),
    );
  });
});

describe("PreviewVoiceDto", () => {
  it("takes a language and a Deepgram voice id", async () => {
    expect(
      await errorsFor(PreviewVoiceDto, {
        language: "es",
        voice: "aura-2-celeste-es",
      }),
    ).toEqual([]);
    expect(
      await errorsFor(PreviewVoiceDto, { language: "fr", voice: "x y" }),
    ).toEqual(["language", "voice"]);
  });
});
