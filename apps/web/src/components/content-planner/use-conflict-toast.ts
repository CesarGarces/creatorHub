"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/i18n-provider";
import type { ContentEventConflict } from "@/lib/content-planner/types";

/** Warns (without blocking) when a saved session overlaps others. */
export function useConflictToast() {
  const { t, formatDate } = useI18n();
  return useCallback(
    (conflicts: ContentEventConflict[]) => {
      const [first] = conflicts;
      if (!first) return;
      const message =
        conflicts.length === 1
          ? t("contentPlanner.conflicts.overlap", { title: first.title })
          : t("contentPlanner.conflicts.overlapMore", {
              title: first.title,
              count: conflicts.length - 1,
            });
      toast.warning(message, {
        description: formatDate(first.startAt, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    },
    [t, formatDate],
  );
}
