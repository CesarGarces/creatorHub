import { describe, expect, expectTypeOf, it } from "vitest";
import * as types from "../index";
import type {
  AIResponse,
  CommunityChannelType,
  ToolJobUpdatePayload,
  ToolManifest,
} from "../index";

/**
 * shared-types is mostly compile-time types. Its runtime values are the
 * contract between the API and the community-worker (queue names, Redis
 * pub/sub channels, STT limits) — changing one breaks the other process
 * silently, so they are pinned here.
 */
describe("community-bot wire contract", () => {
  it("pins the BullMQ queue names", () => {
    expect(types.COMMUNITY_INBOUND_QUEUE).toBe("community-inbound");
    expect(types.COMMUNITY_OUTBOUND_QUEUE).toBe("community-outbound");
    expect(types.COMMUNITY_CHANNEL_COMMAND_QUEUE).toBe(
      "community-channel-commands",
    );
  });

  it("pins the Redis pub/sub channel names", () => {
    expect(types.COMMUNITY_CHANNEL_STATUS_EVENT).toBe(
      "community.channel.status",
    );
    expect(types.COMMUNITY_MESSAGE_RECEIVED_EVENT).toBe(
      "community.message.received",
    );
    expect(types.COMMUNITY_REPLY_SENT_EVENT).toBe("community.reply.sent");
    expect(types.COMMUNITY_REPLY_SKIPPED_EVENT).toBe("community.reply.skipped");
  });

  it("uses distinct names for every queue and channel", () => {
    const names = [
      types.COMMUNITY_INBOUND_QUEUE,
      types.COMMUNITY_OUTBOUND_QUEUE,
      types.COMMUNITY_CHANNEL_COMMAND_QUEUE,
      types.COMMUNITY_CHANNEL_STATUS_EVENT,
      types.COMMUNITY_MESSAGE_RECEIVED_EVENT,
      types.COMMUNITY_REPLY_SENT_EVENT,
      types.COMMUNITY_REPLY_SKIPPED_EVENT,
    ];
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("speech-to-text limits", () => {
  it("keeps sessions to 3 minutes, requiring 5 credits to start", () => {
    expect(types.MAX_STT_SESSION_MS).toBe(180_000);
    expect(types.MIN_CREDITS_FOR_STT).toBe(5);
  });
});

describe("type contracts", () => {
  it("ToolManifest requires the fields the registry relies on", () => {
    expectTypeOf<ToolManifest>().toHaveProperty("id").toEqualTypeOf<string>();
    expectTypeOf<ToolManifest>()
      .toHaveProperty("creditsPerUse")
      .toEqualTypeOf<number>();
    expectTypeOf<ToolManifest["status"]>().toEqualTypeOf<
      "active" | "inactive" | "beta" | "deprecated"
    >();
  });

  it("community channels are Telegram, WhatsApp or Instagram", () => {
    expectTypeOf<CommunityChannelType>().toEqualTypeOf<
      "TELEGRAM" | "WHATSAPP" | "INSTAGRAM"
    >();
  });

  it("tool job updates carry a status the frontend understands", () => {
    expectTypeOf<ToolJobUpdatePayload["status"]>().toMatchTypeOf<string>();
    expectTypeOf<AIResponse>().toHaveProperty("provider");
  });
});

describe("dashboard widgets contract", () => {
  const ids = (list: { id: string }[]) => list.map((w) => w.id);

  it("pins the widget ids stored in user layouts", () => {
    // Stored in DashboardLayout.widgets — renaming one drops it from layouts.
    expect(types.DASHBOARD_WIDGET_IDS).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "activity",
      "recommendations",
      "credits",
      "tips",
      "asset-stats",
    ]);
  });

  it("the default layout lists every widget exactly once, in product order", () => {
    expect(ids([...types.DEFAULT_DASHBOARD_WIDGETS])).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "asset-stats",
      "activity",
      "recommendations",
      "credits",
      "tips",
    ]);
    expect(
      [...types.DEFAULT_DASHBOARD_WIDGETS]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((w) => w.id),
    ).toEqual([...types.DASHBOARD_WIDGET_IDS].sort());
    expect(types.DEFAULT_DASHBOARD_WIDGETS.every((w) => w.visible)).toBe(true);
  });

  it("anything that isn't a list normalizes to the default layout", () => {
    for (const value of [undefined, null, {}, "x", 42]) {
      expect(types.normalizeDashboardWidgets(value)).toEqual(
        types.DEFAULT_DASHBOARD_WIDGETS,
      );
    }
  });

  it("keeps the saved order and visibility, appends missing widgets", () => {
    const result = types.normalizeDashboardWidgets([
      { id: "tips", visible: false },
      { id: "credits", visible: true },
    ]);
    expect(result.slice(0, 2)).toEqual([
      { id: "tips", visible: false },
      { id: "credits", visible: true },
    ]);
    expect(ids(result)).toEqual([
      "tips",
      "credits",
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "asset-stats",
      "activity",
      "recommendations",
    ]);
    expect(result.every((w) => w.visible !== undefined)).toBe(true);
  });

  it("drops unknown ids, duplicates and malformed entries", () => {
    const result = types.normalizeDashboardWidgets([
      { id: "activity", visible: false },
      { id: "activity", visible: true },
      { id: "weather", visible: true },
      null,
      "favorites",
      { id: "favorites", visible: "yes" },
    ]);
    expect(result[0]).toEqual({ id: "activity", visible: false });
    // Non-boolean visibility falls back to the widget's default (shown).
    expect(result[1]).toEqual({ id: "favorites", visible: true });
    expect(ids(result)).toHaveLength(types.DASHBOARD_WIDGET_IDS.length);
    expect(new Set(ids(result)).size).toBe(result.length);
  });

  it("returns fresh objects (the defaults can't be mutated through it)", () => {
    const result = types.normalizeDashboardWidgets(undefined);
    result[0]!.visible = !result[0]!.visible;
    expect(types.DEFAULT_DASHBOARD_WIDGETS[0]!.visible).toBe(true);
  });

  it("a widget added after a layout was saved shows up, at the end", () => {
    const saved = types.DEFAULT_DASHBOARD_WIDGETS.filter(
      (w) => w.id !== "today-plans",
    );
    const result = types.normalizeDashboardWidgets(saved);
    expect(result.at(-1)).toEqual({ id: "today-plans", visible: true });
  });

  it("recognizes widget ids", () => {
    expect(types.isDashboardWidgetId("today-plans")).toBe(true);
    expect(types.isDashboardWidgetId("favorites")).toBe(true);
    expect(types.isDashboardWidgetId("weather")).toBe(false);
    expect(types.isDashboardWidgetId(1)).toBe(false);
  });
});

describe("asset engagement contract", () => {
  it("bounds the top list", () => {
    expect(types.ASSET_ENGAGEMENT_DEFAULT_TOP).toBe(4);
    expect(types.ASSET_ENGAGEMENT_MAX_TOP).toBeGreaterThanOrEqual(
      types.ASSET_ENGAGEMENT_DEFAULT_TOP,
    );
  });
});

describe("text-to-speech contract (Deepgram Aura-2 / Flux)", () => {
  it("speaks every assistant language with its Deepgram voice", () => {
    expect(types.TTS_LANGUAGES).toEqual(["en", "es", "pt"]);
    expect(types.TTS_VOICES.en).toMatchObject({
      model: "aura-2-andromeda-en",
      name: "Andromeda",
      accent: "American",
      gender: "feminine",
    });
    expect(types.TTS_VOICES.es).toMatchObject({
      model: "aura-2-celeste-es",
      name: "Celeste",
      accent: "Colombian",
      gender: "feminine",
    });
    expect(types.TTS_VOICES.pt).toMatchObject({
      model: "flux-bianca-pt",
      name: "Bianca",
      accent: "Brazilian",
      gender: "feminine",
    });
    for (const [language, voice] of Object.entries(types.TTS_VOICES)) {
      expect(voice.language).toBe(language);
      expect(
        types.TTS_MODEL_OPTIONS.some(
          (model) =>
            model.languages.includes(voice.language) &&
            voice.model.startsWith(`${model.id}-`),
        ),
      ).toBe(true);
    }
  });

  it("falls back to the English voice for unknown languages", () => {
    expect(types.ttsVoiceFor("es").name).toBe("Celeste");
    expect(types.ttsVoiceFor("fr").name).toBe("Andromeda");
    expect(types.ttsVoiceFor(undefined).name).toBe("Andromeda");
    expect(types.isTTSLanguage("pt")).toBe(true);
    expect(types.isTTSLanguage("PT")).toBe(false);
  });

  it("pins the reply price and the assistant's identity", () => {
    expect(types.VOICE_ASSISTANT_REPLY_CREDITS).toBe(1);
    expect(types.VOICE_ASSISTANT_TOOL_ID).toBe("voice-assistant");
    expect(types.VOICE_ASSISTANT_NAME).toBe("Robotina");
  });
});

describe("voice settings (Admin → Voice: STT & TTS)", () => {
  it("defaults: Nova-3, Aura-2 for English/Spanish, Flux for Portuguese, 60 cr/min in, 120 cr/min out", () => {
    const d = types.DEFAULT_VOICE_SETTINGS;
    expect(d.stt).toEqual({
      provider: "deepgram",
      model: "nova-3",
      creditsPerMinute: 60,
    });
    expect(d.tts.creditsPerMinute).toBe(120);
    expect(d.tts.voices).toEqual({
      en: { model: "aura-2", voice: "aura-2-andromeda-en" },
      es: { model: "aura-2", voice: "aura-2-celeste-es" },
      pt: { model: "flux", voice: "flux-bianca-pt" },
    });
    expect(d.updatedAt).toBeNull();
  });

  it("bills every started second at the per-minute rate, rounded up to whole credits", () => {
    expect(types.voiceCredits(0, 60)).toBe(0);
    expect(types.voiceCredits(5000, 0)).toBe(0);
    expect(types.voiceCredits(1, 60)).toBe(1);
    expect(types.voiceCredits(2300, 60)).toBe(3);
    expect(types.voiceCredits(4200, 120)).toBe(10);
    expect(types.voiceCredits(30_000, 1.2)).toBe(1);
    expect(types.voiceCredits(3000, 6)).toBe(1); // not 2 (float noise)
    expect(types.voiceCredits(60_000, 90)).toBe(90);
  });

  it("knows how many seconds a balance pays for", () => {
    expect(types.voiceSecondsAffordable(10, 120)).toBe(5);
    expect(types.voiceSecondsAffordable(5, 60)).toBe(5);
    expect(types.voiceSecondsAffordable(1, 18)).toBe(3);
    expect(types.voiceSecondsAffordable(-4, 60)).toBe(0);
    expect(types.voiceSecondsAffordable(0, 0)).toBe(Infinity);
  });

  it("accepts prices from 0 to 6,000 credits per minute, in cents", () => {
    for (const ok of [0, 0.06, 60, 120, 150, 6000]) {
      expect(types.isVoiceCreditRate(ok)).toBe(true);
    }
    for (const bad of [-1, 6000.01, 0.006, Number.NaN, "60", null]) {
      expect(types.isVoiceCreditRate(bad)).toBe(false);
    }
  });

  it("lists Deepgram voices per model and language", () => {
    const es = types.ttsVoicesFor("aura-2", "es");
    expect(es[0]).toMatchObject({ name: "Celeste", accent: "Colombian" });
    expect(es.every((v) => v.model.endsWith("-es"))).toBe(true);
    expect(types.ttsVoicesFor("aura-2", "pt")).toEqual([]);
    expect(types.ttsVoicesFor("flux", "pt").map((v) => v.name)).toContain(
      "Bianca",
    );
    expect(types.ttsVoicesFor("flux", "pt")[0]).toMatchObject({
      model: "flux-bianca-pt",
      accent: "Brazilian",
    });
    expect(types.ttsVoicesFor("aura", "es")).toEqual([]);
    expect(types.ttsVoicesFor("aura", "en").length).toBeGreaterThan(5);
    const ids = types.TTS_VOICE_CATALOG.map((v) => v.model);
    expect(new Set(ids).size).toBe(ids.length);
    for (const v of types.TTS_VOICE_CATALOG) {
      expect(types.isTTSVoiceId(v.family, v.model, v.language)).toBe(true);
    }
  });

  it("validates typed voice ids against model and language", () => {
    expect(types.isTTSVoiceId("flux", "flux-nuevo-pt", "pt")).toBe(true);
    expect(types.isTTSVoiceId("aura-2", "aura-2-nuevo-pt", "pt")).toBe(false);
    expect(types.isTTSVoiceId("aura-2", "aura-2-celeste-es", "pt")).toBe(false);
    expect(types.isTTSVoiceId("aura", "aura-2-celeste-es", "es")).toBe(false);
    expect(types.isTTSVoiceId("aura", "aura-2-thalia-en", "en")).toBe(false);
    expect(types.isTTSVoiceId("aura-3", "aura-3-x-en", "en")).toBe(false);
    expect(types.isTTSVoiceId("aura-2", "aura-2-<script>-en", "en")).toBe(
      false,
    );
    expect(types.ttsVoiceInfo("flux-nuevo-pt", "pt")).toMatchObject({
      family: "flux",
      name: "Nuevo",
      language: "pt",
    });
  });

  it("listens in every language with a multilingual model only", () => {
    expect(types.sttListenLanguage("nova-3", "es")).toBe("multi");
    expect(types.sttListenLanguage("nova-2", "es")).toBe("es");
    expect(types.sttListenLanguage("base")).toBe("en");
    expect(types.isSTTModel("nova-3")).toBe(true);
    expect(types.isSTTModel("whisper")).toBe(false);
  });

  it("publishes prices and who speaks each language", () => {
    const pricing = types.voicePricingFrom({
      ...types.DEFAULT_VOICE_SETTINGS,
      tts: {
        ...types.DEFAULT_VOICE_SETTINGS.tts,
        voices: {
          ...types.DEFAULT_VOICE_SETTINGS.tts.voices,
          es: { model: "aura-2", voice: "aura-2-javier-es" },
        },
      },
    });
    expect(pricing.stt).toEqual({ model: "nova-3", creditsPerMinute: 60 });
    expect(pricing.tts.creditsPerMinute).toBe(120);
    expect(pricing.tts.voices.es).toEqual({
      model: "aura-2-javier-es",
      name: "Javier",
      accent: "Mexican",
      gender: "masculine",
    });
  });
});

describe("voice settings validation", () => {
  const valid = {
    sttModel: "nova-3",
    sttCreditsPerMinute: 60,
    ttsCreditsPerMinute: 120,
    ttsVoices: { ...types.DEFAULT_TTS_LANGUAGE_VOICES },
    freeTierMinutes: null,
    freeTierPeriod: "monthly",
  };

  it("accepts the defaults and catalog choices", () => {
    expect(types.voiceSettingsErrors(valid)).toEqual([]);
    expect(
      types.voiceSettingsErrors({
        ...valid,
        sttModel: "nova-2",
        ttsVoices: {
          en: { model: "aura", voice: "aura-asteria-en" },
          es: { model: "aura-2", voice: "aura-2-javier-es" },
          pt: { model: "flux", voice: "flux-bianca-pt" },
        },
      }),
    ).toEqual([]);
  });

  it("points at each wrong field", () => {
    expect(
      types.voiceSettingsErrors({
        sttModel: "whisper",
        sttCreditsPerMinute: -1,
        ttsCreditsPerMinute: "2",
        ttsVoices: {
          en: { model: "aura-2", voice: "aura-2-celeste-es" },
          es: { model: "aura", voice: "aura-luna-es" },
        },
        freeTierMinutes: null,
        freeTierPeriod: "monthly",
      }),
    ).toEqual([
      { field: "sttModel", code: "invalidModel" },
      { field: "sttCreditsPerMinute", code: "invalidRate" },
      { field: "ttsCreditsPerMinute", code: "invalidRate" },
      { field: "ttsVoices.en", code: "invalidVoice" },
      { field: "ttsVoices.es", code: "invalidModel" },
      { field: "ttsVoices.pt", code: "invalidModel" },
    ]);
    expect(types.voiceSettingsErrors(null)).toHaveLength(8);
  });
});

describe("Free plan minutes with Robotina", () => {
  const now = new Date("2026-11-29T10:00:00Z");

  it("has no limit until the admin sets one", () => {
    expect(types.DEFAULT_VOICE_SETTINGS.freeTier).toEqual({
      minutes: null,
      period: "monthly",
    });
    expect(
      types.voicePricingFrom(types.DEFAULT_VOICE_SETTINGS).freeTier,
    ).toBeNull();
    expect(
      types.voicePricingFrom({
        ...types.DEFAULT_VOICE_SETTINGS,
        freeTier: { minutes: 10, period: "lifetime" },
      }).freeTier,
    ).toEqual({ minutes: 10, period: "lifetime" });
  });

  it("validates whole minutes from 1 to 10,000 and the period", () => {
    const base = {
      sttModel: "nova-3",
      sttCreditsPerMinute: 60,
      ttsCreditsPerMinute: 120,
      ttsVoices: { ...types.DEFAULT_TTS_LANGUAGE_VOICES },
    };
    for (const minutes of [null, 1, 10, 20, 10_000]) {
      expect(
        types.voiceSettingsErrors({
          ...base,
          freeTierMinutes: minutes,
          freeTierPeriod: "monthly",
        }),
      ).toEqual([]);
    }
    expect(
      types.voiceSettingsErrors({
        ...base,
        freeTierMinutes: 0,
        freeTierPeriod: "weekly",
      }),
    ).toEqual([
      { field: "freeTierMinutes", code: "invalidMinutes" },
      { field: "freeTierPeriod", code: "invalidPeriod" },
    ]);
    for (const bad of [1.5, -3, 10_001, "10"]) {
      expect(types.isFreeTierMinutes(bad)).toBe(false);
    }
  });

  it("keeps usage per UTC month, or once for a lifetime limit", () => {
    expect(types.voiceUsagePeriodKey("monthly", now)).toBe("2026-11");
    expect(
      types.voiceUsagePeriodKey("monthly", new Date("2027-01-01T00:00:00Z")),
    ).toBe("2027-01");
    expect(types.voiceUsagePeriodKey("lifetime", now)).toBe("all");
    expect(types.nextMonthStart(new Date("2026-12-31T23:59:59Z"))).toEqual(
      new Date("2027-01-01T00:00:00Z"),
    );
  });

  it("computes what is left for Free users only", () => {
    const limit = { minutes: 10, period: "monthly" as const };
    expect(types.voiceAllowanceFrom(limit, 420, true, now)).toEqual({
      limited: true,
      period: "monthly",
      limitSeconds: 600,
      usedSeconds: 420,
      remainingSeconds: 180,
      exhausted: false,
      resetsAt: "2026-12-01T00:00:00.000Z",
    });
    expect(types.voiceAllowanceFrom(limit, 700, true, now)).toMatchObject({
      remainingSeconds: 0,
      exhausted: true,
    });
    // Paid plans and "no limit": unlimited.
    for (const allowance of [
      types.voiceAllowanceFrom(limit, 9999, false, now),
      types.voiceAllowanceFrom(
        { minutes: null, period: "monthly" },
        9999,
        true,
        now,
      ),
    ]) {
      expect(allowance).toMatchObject({
        limited: false,
        remainingSeconds: null,
        exhausted: false,
        resetsAt: null,
      });
    }
    expect(
      types.voiceAllowanceFrom(
        { minutes: 20, period: "lifetime" },
        0,
        true,
        now,
      ).resetsAt,
    ).toBeNull();
  });
});
