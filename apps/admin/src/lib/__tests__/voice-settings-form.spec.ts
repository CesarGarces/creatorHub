import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_SETTINGS } from "@creator-hub/shared-types";
import {
  CUSTOM_VOICE,
  creditsFor,
  defaultVoiceForm,
  formFromSettings,
  hasVoiceErrors,
  isVoiceFormDirty,
  modelsFor,
  parseMinutes,
  parseRate,
  toVoiceSettingsPayload,
  validateVoiceForm,
  withVoiceModel,
} from "../voice-settings-form";

const saved = {
  ...DEFAULT_VOICE_SETTINGS,
  tts: {
    ...DEFAULT_VOICE_SETTINGS.tts,
    voices: {
      ...DEFAULT_VOICE_SETTINGS.tts.voices,
      // A voice Deepgram released after this catalog.
      pt: { model: "flux", voice: "flux-paula-pt" },
    },
  },
  updatedAt: "2026-11-29T10:00:00.000Z",
};

describe("voice settings form", () => {
  it("starts from the platform defaults", () => {
    const form = defaultVoiceForm();
    expect(form).toMatchObject({
      sttModel: "nova-3",
      sttCreditsPerSecond: "1",
      ttsCreditsPerSecond: "2",
    });
    expect(form.voices.es).toEqual({
      model: "aura-2",
      voice: "aura-2-celeste-es",
      customVoice: "",
    });
    expect(validateVoiceForm(form)).toEqual({});
  });

  it("shows voices outside the catalog as typed ids", () => {
    const form = formFromSettings(saved);
    expect(form.voices.pt).toEqual({
      model: "flux",
      voice: CUSTOM_VOICE,
      customVoice: "flux-paula-pt",
    });
    expect(toVoiceSettingsPayload(form).ttsVoices.pt.voice).toBe(
      "flux-paula-pt",
    );
    expect(isVoiceFormDirty(form, saved)).toBe(false);
  });

  it("offers Aura-1 only for English, and switching model picks its first voice", () => {
    expect(modelsFor("en").map((m) => m.id)).toEqual(["aura-2", "aura"]);
    expect(modelsFor("es").map((m) => m.id)).toEqual(["aura-2"]);
    expect(modelsFor("pt").map((m) => m.id)).toEqual(["flux"]);
    const form = withVoiceModel(defaultVoiceForm(), "en", "aura");
    expect(form.voices.en).toEqual({
      model: "aura",
      voice: "aura-asteria-en",
      customVoice: "",
    });
    expect(isVoiceFormDirty(form, DEFAULT_VOICE_SETTINGS)).toBe(true);
  });

  it("builds the PUT body with numeric prices", () => {
    const form = {
      ...defaultVoiceForm(),
      sttModel: "nova-2",
      sttCreditsPerSecond: "0,5",
      ttsCreditsPerSecond: "2.25",
    };
    expect(toVoiceSettingsPayload(form)).toEqual({
      sttModel: "nova-2",
      sttCreditsPerSecond: 0.5,
      ttsCreditsPerSecond: 2.25,
      ttsVoices: DEFAULT_VOICE_SETTINGS.tts.voices,
      freeTierMinutes: null,
      freeTierPeriod: "monthly",
    });
  });

  it("flags bad prices and voice ids like the API does", () => {
    const form = defaultVoiceForm();
    form.sttCreditsPerSecond = "abc";
    form.ttsCreditsPerSecond = "101";
    form.voices.es = {
      model: "aura-2",
      voice: CUSTOM_VOICE,
      customVoice: "aura-2-thalia-en",
    };
    const errors = validateVoiceForm(form);
    expect(errors).toEqual({
      sttCreditsPerSecond: "invalidRate",
      ttsCreditsPerSecond: "invalidRate",
      "ttsVoices.es": "invalidVoice",
    });
    expect(hasVoiceErrors(errors)).toBe(true);
    expect(parseRate("-1")).toBeNaN();
    expect(parseRate(" 3 ")).toBe(3);
  });

  it("explains prices in credits for real durations", () => {
    expect(creditsFor("1", 60)).toBe(60);
    expect(creditsFor("2", 20)).toBe(40);
    expect(creditsFor("0.02", 30)).toBe(1);
    expect(creditsFor("0", 60)).toBe(0);
    expect(creditsFor("x", 60)).toBeNull();
  });

  it("limits the Free plan only when switched on", () => {
    const form = defaultVoiceForm();
    expect(form).toMatchObject({
      freeTierEnabled: false,
      freeTierMinutes: "10",
      freeTierPeriod: "monthly",
    });
    expect(toVoiceSettingsPayload(form).freeTierMinutes).toBeNull();
    // Minutes typed while off don't matter.
    expect(
      isVoiceFormDirty(
        { ...form, freeTierMinutes: "99" },
        DEFAULT_VOICE_SETTINGS,
      ),
    ).toBe(false);

    const on = {
      ...form,
      freeTierEnabled: true,
      freeTierMinutes: "20",
      freeTierPeriod: "lifetime" as const,
    };
    expect(toVoiceSettingsPayload(on)).toMatchObject({
      freeTierMinutes: 20,
      freeTierPeriod: "lifetime",
    });
    expect(validateVoiceForm(on)).toEqual({});
    expect(
      validateVoiceForm({ ...on, freeTierMinutes: "1.5" }).freeTierMinutes,
    ).toBe("invalidMinutes");
    expect(
      validateVoiceForm({ ...on, freeTierMinutes: "0" }).freeTierMinutes,
    ).toBe("invalidMinutes");
    expect(parseMinutes(" 15 ")).toBe(15);
  });

  it("shows a saved limit", () => {
    const form = formFromSettings({
      ...DEFAULT_VOICE_SETTINGS,
      freeTier: { minutes: 30, period: "lifetime" },
    });
    expect(form).toMatchObject({
      freeTierEnabled: true,
      freeTierMinutes: "30",
      freeTierPeriod: "lifetime",
    });
  });
});
