"use client";

import { useCallback } from "react";
import { DEFAULT_LOCALE } from "./config";
import { useI18n } from "./i18n-provider";

interface PlanLike {
  slug?: string;
  name: string;
  description?: string | null;
}

/**
 * Localized name/description for credit plans served by the API.
 * Same approach as useToolText: English shows the API text verbatim, other
 * languages use `credits.planCatalog` and fall back to the API text.
 */
export function usePlanText() {
  const { locale, tOptional } = useI18n();
  const useSource = locale === DEFAULT_LOCALE;

  const planName = useCallback(
    (plan: PlanLike) =>
      useSource || !plan.slug
        ? plan.name
        : tOptional(`credits.planCatalog.${plan.slug}.name`, plan.name),
    [useSource, tOptional],
  );

  const planDescription = useCallback(
    (plan: PlanLike) => {
      const source = plan.description ?? "";
      return useSource || !plan.slug
        ? source
        : tOptional(`credits.planCatalog.${plan.slug}.description`, source);
    },
    [useSource, tOptional],
  );

  return { planName, planDescription };
}
