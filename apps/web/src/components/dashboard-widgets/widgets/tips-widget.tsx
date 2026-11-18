"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Skeleton } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { useAuthStore } from "@/store/auth.store";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import {
  loadProTips,
  localHour,
  tipIndexForHour,
} from "@/lib/dashboard-widgets/pro-tips";
import { WidgetHeader } from "../widget-header";

/**
 * "Pro tip": one of the platform's tips (JSON content, in the user's
 * language), a different one every hour — random order, every tip once
 * before any repeats, never the same twice in a row, and a different order
 * for each user. Changes at :00 on the user's clock while the dashboard is
 * open. The card keeps a minimum height so tips of different lengths don't
 * move the widgets below.
 */
export function TipsWidget() {
  const { t, locale } = useI18n();
  const userId = useAuthStore((s) => s.user?.id) ?? "";
  const now = useMinuteClock();

  const {
    data: tips,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["pro-tips", locale],
    queryFn: () => loadProTips(locale),
    staleTime: Infinity,
  });

  const index = tips?.length
    ? tipIndexForHour(localHour(now), tips.length, userId)
    : -1;
  const tip = index >= 0 ? tips![index] : undefined;

  return (
    <section>
      <WidgetHeader
        title={t("dashboard.widgets.tips.name")}
        action={
          tip ? (
            <span className="text-xs tabular-nums text-text-dim">
              {t("dashboard.tips.position", {
                index: index + 1,
                total: tips!.length,
              })}
            </span>
          ) : undefined
        }
      />
      <div className="min-h-[180px] rounded-xl border border-border bg-surface p-5">
        {tip ? (
          <article data-tip-id={tip.id} className="flex items-start gap-3">
            <span aria-hidden="true" className="text-lg">
              💡
            </span>
            <div className="min-w-0">
              <Badge variant="accent" size="sm">
                {t(`dashboard.tips.categories.${tip.category}`)}
              </Badge>
              <h3 className="mt-2 text-sm font-semibold text-text">
                {tip.title}
              </h3>
              <p className="mt-1 text-sm text-text-muted">{tip.body}</p>
              <p className="mt-3 text-xs text-text-dim">
                {t("dashboard.tips.everyHour")}
              </p>
            </div>
          </article>
        ) : isError || (!isPending && !tip) ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-text-muted">
              {t("dashboard.tips.error")}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11"
            >
              {t("dashboard.tips.retry")}
            </button>
          </div>
        ) : (
          <div aria-hidden="true" className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
