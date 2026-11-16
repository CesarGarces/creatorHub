"use client";

import { useCallback } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import { formatDurationText } from "@/lib/content-planner/reminders";

/** Minutes → "20h 30m", "3h", "45m" in the interface language. */
export function useFormatDuration() {
  const { t } = useI18n();
  return useCallback((minutes: number) => formatDurationText(minutes, t), [t]);
}
