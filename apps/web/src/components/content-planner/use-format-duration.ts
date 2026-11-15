"use client";

import { useCallback } from "react";
import { useI18n } from "@/i18n/i18n-provider";

/** Minutes → "20h 30m", "3h", "45m" in the interface language. */
export function useFormatDuration() {
  const { t } = useI18n();
  return useCallback(
    (totalMinutes: number) => {
      const rounded = Math.max(0, Math.round(totalMinutes));
      const hours = Math.floor(rounded / 60);
      const minutes = rounded % 60;
      if (hours === 0) return t("contentPlanner.plan.durationM", { minutes });
      if (minutes === 0) return t("contentPlanner.plan.durationH", { hours });
      return t("contentPlanner.plan.durationHM", { hours, minutes });
    },
    [t],
  );
}
