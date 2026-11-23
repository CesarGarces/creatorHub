"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_VOICE_SETTINGS,
  TTS_LANGUAGES,
  isVoiceCreditRate,
  voicePricingFrom,
  type VoicePricing,
} from "@creator-hub/shared-types";
import api from "@/lib/api";

/** Prices and voices until the API answers (the platform defaults). */
export const DEFAULT_VOICE_PRICING: VoicePricing = voicePricingFrom(
  DEFAULT_VOICE_SETTINGS,
);

let pending: Promise<VoicePricing> | null = null;

function isVoicePricing(value: unknown): value is VoicePricing {
  const v = value as Partial<VoicePricing> | null;
  return (
    !!v &&
    isVoiceCreditRate(v.stt?.creditsPerMinute) &&
    isVoiceCreditRate(v.tts?.creditsPerMinute) &&
    TTS_LANGUAGES.every(
      (language) => typeof v.tts?.voices?.[language]?.name === "string",
    )
  );
}

/**
 * Voice prices and voices, as set in Admin → Voice (STT & TTS): credits per
 * minute of voice input (every voice button) and of Robotina's speech, and
 * who speaks each language. Fetched once and shared by every voice button.
 */
export function fetchVoicePricing(): Promise<VoicePricing> {
  pending ??= Promise.resolve()
    .then(() => api.get<VoicePricing>("/voice/pricing"))
    .then((pricing) =>
      isVoicePricing(pricing)
        ? { ...pricing, freeTier: pricing.freeTier ?? null }
        : DEFAULT_VOICE_PRICING,
    )
    .catch(() => {
      pending = null; // retry next time
      return DEFAULT_VOICE_PRICING;
    });
  return pending;
}

export function useVoicePricing(): VoicePricing {
  const [pricing, setPricing] = useState(DEFAULT_VOICE_PRICING);
  useEffect(() => {
    let alive = true;
    void fetchVoicePricing().then((value) => alive && setPricing(value));
    return () => {
      alive = false;
    };
  }, []);
  return pricing;
}

/** Credits per minute of voice input (shown next to every voice button). */
export function useSttCreditsPerMinute(): number {
  return useVoicePricing().stt.creditsPerMinute;
}

/** Tests only. */
export function __resetVoicePricingCache(): void {
  pending = null;
}
