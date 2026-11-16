"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

/** Fallback price of voice input (matches the API's STT_CREDITS_PER_MINUTE). */
export const DEFAULT_STT_CREDITS_PER_MINUTE = 1;

let pending: Promise<number> | null = null;

/**
 * Credits per minute of voice input, as set in Admin → AI Models (the
 * active "speech-to-text" model's credit cost). Fetched once and shared by
 * every voice button.
 */
export function fetchSttCreditsPerMinute(): Promise<number> {
  pending ??= Promise.resolve()
    .then(() =>
      api.get<{ creditCost: number; isActive: boolean }[]>("/ai/models", {
        params: { taskTypes: "speech-to-text" },
      }),
    )
    .then((models) => {
      const active = Array.isArray(models)
        ? models.find((m) => m.isActive)
        : undefined;
      const cost = active?.creditCost;
      return typeof cost === "number" && cost >= 0
        ? cost
        : DEFAULT_STT_CREDITS_PER_MINUTE;
    })
    .catch(() => {
      pending = null; // retry next time
      return DEFAULT_STT_CREDITS_PER_MINUTE;
    });
  return pending;
}

export function useSttCreditsPerMinute(): number {
  const [rate, setRate] = useState(DEFAULT_STT_CREDITS_PER_MINUTE);
  useEffect(() => {
    let alive = true;
    void fetchSttCreditsPerMinute().then((value) => alive && setRate(value));
    return () => {
      alive = false;
    };
  }, []);
  return rate;
}

/** Tests only. */
export function __resetSttRateCache(): void {
  pending = null;
}
