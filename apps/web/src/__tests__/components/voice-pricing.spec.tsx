import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import type { VoicePricing } from "@creator-hub/shared-types";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ default: { get } }));

import {
  DEFAULT_VOICE_PRICING,
  __resetVoicePricingCache,
  fetchVoicePricing,
  useSttCreditsPerSecond,
  useVoicePricing,
} from "@/components/voice-button/use-voice-pricing";
import { VoiceButton } from "@/components/voice-button";

const PRICING: VoicePricing = {
  stt: { model: "nova-2", creditsPerSecond: 0.5 },
  freeTier: { minutes: 10, period: "monthly" },
  tts: {
    creditsPerSecond: 3,
    voices: {
      en: {
        model: "aura-2-orion-en",
        name: "Orion",
        accent: "American",
        gender: "masculine",
      },
      es: {
        model: "aura-2-estrella-es",
        name: "Estrella",
        accent: "Mexican",
        gender: "feminine",
      },
      pt: {
        model: "aura-2-bianca-pt",
        name: "Bianca",
        accent: "Brazilian",
        gender: "feminine",
      },
    },
  },
};

beforeEach(() => {
  get.mockReset();
  __resetVoicePricingCache();
});

describe("voice prices (Admin → Voice: STT & TTS)", () => {
  it("reads the prices per second and voices from the API", async () => {
    get.mockResolvedValue(PRICING);
    await expect(fetchVoicePricing()).resolves.toEqual(PRICING);
    expect(get).toHaveBeenCalledWith("/voice/pricing");
  });

  it("defaults to 1 cr/s in, 2 cr/s out and the Aura-2 voices", () => {
    expect(DEFAULT_VOICE_PRICING.stt.creditsPerSecond).toBe(1);
    expect(DEFAULT_VOICE_PRICING.tts.creditsPerSecond).toBe(2);
    expect(DEFAULT_VOICE_PRICING.tts.voices.es.name).toBe("Celeste");
  });

  it("falls back on bad data, and on errors retries next time", async () => {
    get.mockResolvedValueOnce({ nope: true });
    await expect(fetchVoicePricing()).resolves.toEqual(DEFAULT_VOICE_PRICING);

    __resetVoicePricingCache();
    get.mockRejectedValueOnce(new Error("offline"));
    await expect(fetchVoicePricing()).resolves.toEqual(DEFAULT_VOICE_PRICING);
    get.mockResolvedValueOnce(PRICING);
    await expect(fetchVoicePricing()).resolves.toEqual(PRICING);
  });

  it("survives an API client that throws synchronously", async () => {
    get.mockImplementation(() => {
      throw new Error("not ready");
    });
    await expect(fetchVoicePricing()).resolves.toEqual(DEFAULT_VOICE_PRICING);
  });

  it("asks the API once for every voice button on the page", async () => {
    get.mockResolvedValue(PRICING);
    const a = renderHook(() => useSttCreditsPerSecond());
    const b = renderHook(() => useVoicePricing());
    expect(a.result.current).toBe(1); // default until loaded
    await waitFor(() => expect(a.result.current).toBe(0.5));
    await waitFor(() =>
      expect(b.result.current.tts.voices.en.name).toBe("Orion"),
    );
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("the recording button shows the configured price per second", async () => {
    get.mockResolvedValue(PRICING);
    render(<VoiceButton isListening onToggle={() => {}} />);
    expect(await screen.findByText("+0.5 cr/s")).toBeTruthy();
  });
});
