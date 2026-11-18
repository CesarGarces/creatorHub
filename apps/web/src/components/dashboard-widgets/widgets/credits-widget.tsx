"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { Skeleton, cn } from "@creator-hub/ui";
import { useCreditsStore } from "@/store/credits.store";
import { useI18n } from "@/i18n/i18n-provider";
import { WidgetHeader } from "../widget-header";

/** At or below this balance the widget suggests topping up (§8 states). */
export const LOW_CREDITS = 50;

/** Balance and plan at a glance, with a shortcut to buy credits. */
export function CreditsWidget() {
  const { t, tOptional, formatNumber } = useI18n();
  const { balance, plan, isHydrated, fetchBalance } = useCreditsStore();

  useEffect(() => {
    // The top bar usually loaded it already.
    if (!isHydrated) void fetchBalance();
  }, [isHydrated, fetchBalance]);

  const low = isHydrated && balance <= LOW_CREDITS;

  return (
    <section>
      <WidgetHeader title={t("dashboard.widgets.credits.name")} />
      <div
        className={cn(
          "flex min-h-[142px] flex-col justify-between gap-4 rounded-xl border bg-surface p-5",
          low ? "border-warning/40" : "border-border",
        )}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <Coins className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            {isHydrated ? (
              <p className="text-2xl font-bold tabular-nums text-text">
                {formatNumber(balance)}{" "}
                <span className="text-sm font-medium text-text-muted">
                  {t("dashboard.creditsWidget.available", { count: balance })}
                </span>
              </p>
            ) : (
              <Skeleton className="h-8 w-40" />
            )}
            <p className="mt-1 text-sm text-text-muted">
              {t("dashboard.creditsWidget.plan", {
                plan: tOptional(`common.plans.${plan}`, plan),
              })}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={cn("text-xs", low ? "text-warning" : "text-text-dim")}>
            {low ? t("dashboard.creditsWidget.low") : "\u00a0"}
          </p>
          <Link
            href="/credits"
            className="inline-flex items-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover pointer-coarse:min-h-11"
          >
            {t("dashboard.creditsWidget.buy")}
          </Link>
        </div>
      </div>
    </section>
  );
}
