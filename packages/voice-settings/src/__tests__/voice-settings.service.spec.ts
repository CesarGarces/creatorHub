import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  DEFAULT_TTS_LANGUAGE_VOICES,
  DEFAULT_VOICE_SETTINGS,
} from "@creator-hub/shared-types";

const db = vi.hoisted(() => ({
  voiceSettings: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@creator-hub/database", () => ({ prisma: db }));

import {
  VOICE_SETTINGS_CACHE_MS,
  VoiceSettingsService,
  toVoiceSettings,
} from "../voice-settings.service";

const UPDATED = new Date("2026-11-29T10:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "global",
    sttModel: "nova-2",
    sttCreditsPerMinute: 30,
    ttsCreditsPerMinute: 180,
    ttsVoices: {
      en: { model: "aura", voice: "aura-luna-en" },
      es: { model: "aura-2", voice: "aura-2-javier-es" },
      pt: { model: "flux", voice: "flux-bianca-pt" },
    },
    freeTierMinutes: 20,
    freeTierPeriod: "lifetime",
    updatedById: "admin-1",
    createdAt: UPDATED,
    updatedAt: UPDATED,
    ...overrides,
  };
}

const update = {
  sttModel: "nova-3",
  sttCreditsPerMinute: 60,
  ttsCreditsPerMinute: 120,
  ttsVoices: {
    ...DEFAULT_TTS_LANGUAGE_VOICES,
    es: { model: "aura-2", voice: "aura-2-estrella-es" },
  },
  freeTierMinutes: 10,
  freeTierPeriod: "monthly" as const,
};

beforeEach(() => {
  db.voiceSettings.findUnique.mockReset();
  db.voiceSettings.upsert.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("VoiceSettingsService", () => {
  it("reads the saved settings", async () => {
    db.voiceSettings.findUnique.mockResolvedValue(row());
    const settings = await new VoiceSettingsService().get();
    expect(db.voiceSettings.findUnique).toHaveBeenCalledWith({
      where: { id: "global" },
    });
    expect(settings).toEqual({
      stt: { provider: "deepgram", model: "nova-2", creditsPerMinute: 30 },
      tts: {
        provider: "deepgram",
        creditsPerMinute: 180,
        voices: row().ttsVoices,
      },
      freeTier: { minutes: 20, period: "lifetime" },
      updatedAt: UPDATED.toISOString(),
    });
  });

  it("uses the defaults while nothing is saved", async () => {
    db.voiceSettings.findUnique.mockResolvedValue(null);
    expect(await new VoiceSettingsService().get()).toEqual(
      DEFAULT_VOICE_SETTINGS,
    );
  });

  it("caches reads for 30 s and shares one query between callers", async () => {
    db.voiceSettings.findUnique.mockResolvedValue(row());
    const service = new VoiceSettingsService();
    await Promise.all([service.get(1000), service.get(1000)]);
    await service.get(1000 + VOICE_SETTINGS_CACHE_MS - 1);
    expect(db.voiceSettings.findUnique).toHaveBeenCalledTimes(1);
    await service.get(1000 + VOICE_SETTINGS_CACHE_MS);
    expect(db.voiceSettings.findUnique).toHaveBeenCalledTimes(2);
    service.invalidate();
    await service.get(1000 + VOICE_SETTINGS_CACHE_MS);
    expect(db.voiceSettings.findUnique).toHaveBeenCalledTimes(3);
  });

  it("never fails to read: keeps the last value (or the defaults) if the database fails", async () => {
    const service = new VoiceSettingsService();
    db.voiceSettings.findUnique.mockRejectedValueOnce(new Error("db down"));
    expect(await service.get(0)).toEqual(DEFAULT_VOICE_SETTINGS);

    db.voiceSettings.findUnique.mockResolvedValueOnce(row());
    await service.get(VOICE_SETTINGS_CACHE_MS);
    db.voiceSettings.findUnique.mockRejectedValueOnce(new Error("db down"));
    const kept = await service.get(3 * VOICE_SETTINGS_CACHE_MS);
    expect(kept.stt.model).toBe("nova-2");
  });

  it("saves valid settings and serves them at once", async () => {
    db.voiceSettings.findUnique.mockResolvedValue(row());
    db.voiceSettings.upsert.mockImplementation(async ({ create }) => ({
      ...create,
      createdAt: UPDATED,
      updatedAt: UPDATED,
    }));
    const service = new VoiceSettingsService();
    await service.get();
    const saved = await service.update(update, "admin-7");
    expect(db.voiceSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "global" },
        update: expect.objectContaining({
          sttModel: "nova-3",
          sttCreditsPerMinute: 60,
          ttsCreditsPerMinute: 120,
          freeTierMinutes: 10,
          freeTierPeriod: "monthly",
          updatedById: "admin-7",
        }),
      }),
    );
    expect(saved.tts.voices.es.voice).toBe("aura-2-estrella-es");
    expect(saved.freeTier).toEqual({ minutes: 10, period: "monthly" });
    expect((await service.get()).tts.voices.es.voice).toBe(
      "aura-2-estrella-es",
    );
    expect(await service.voiceFor("es")).toMatchObject({
      name: "Estrella",
      accent: "Mexican",
    });
    expect((await service.voiceFor("fr")).model).toBe("aura-2-andromeda-en");
  });

  it("rejects invalid settings without saving", async () => {
    const service = new VoiceSettingsService();
    await expect(
      service.update({ ...update, ttsCreditsPerMinute: -2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.update({
        ...update,
        ttsVoices: {
          ...update.ttsVoices,
          pt: { model: "aura", voice: "aura-luna-en" },
        },
      }),
    ).rejects.toThrow(/ttsVoices\.pt/);
    expect(db.voiceSettings.upsert).not.toHaveBeenCalled();
  });
});

describe("toVoiceSettings", () => {
  it("falls back field by field when a stored value is invalid", () => {
    const settings = toVoiceSettings(
      row({
        sttModel: "whisper",
        sttCreditsPerMinute: -1,
        ttsCreditsPerMinute: Number.NaN,
        ttsVoices: { es: { model: "aura-2", voice: "aura-2-javier-es" } },
        freeTierMinutes: 0,
        freeTierPeriod: "weekly",
      }),
    );
    expect(settings.freeTier).toEqual({ minutes: null, period: "monthly" });
    expect(settings.stt.model).toBe("nova-3");
    expect(settings.stt.creditsPerMinute).toBe(60);
    expect(settings.tts.creditsPerMinute).toBe(120);
    expect(settings.tts.voices).toEqual({
      ...DEFAULT_TTS_LANGUAGE_VOICES,
      es: { model: "aura-2", voice: "aura-2-javier-es" },
    });
    expect(toVoiceSettings(row({ ttsVoices: null })).tts.voices).toEqual(
      DEFAULT_TTS_LANGUAGE_VOICES,
    );
    // Aura-2 never spoke Portuguese: old rows fall back to the Flux default.
    expect(
      toVoiceSettings(
        row({
          ttsVoices: {
            pt: { model: "aura-2", voice: "aura-2-bianca-pt" },
          },
        }),
      ).tts.voices.pt,
    ).toEqual({ model: "flux", voice: "flux-bianca-pt" });
  });
});
