"use client";

import { useCallback } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import type {
  ContentCustomType,
  ContentEventType,
} from "@/lib/content-planner/types";

/** Display name of a session's type: the custom name, or the translated built-in. */
export function useTypeLabel() {
  const { t } = useI18n();
  return useCallback(
    (event: {
      type: ContentEventType;
      customType?: ContentCustomType | null;
    }) => event.customType?.name ?? t(`contentPlanner.types.${event.type}`),
    [t],
  );
}
