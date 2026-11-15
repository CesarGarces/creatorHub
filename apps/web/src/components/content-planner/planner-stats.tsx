"use client";

import { useI18n } from "@/i18n/i18n-provider";
import type { ContentPlannerStats } from "@/lib/content-planner/types";
import { useFormatDuration } from "./use-format-duration";

/**
 * Summary cards. The totals come from the API and cover every session the
 * user has registered (cancelled ones excluded), not only the period on
 * screen; the store refreshes them after every change.
 */
export function PlannerStats({ stats }: { stats: ContentPlannerStats | null }) {
  const { t, formatNumber } = useI18n();
  // Same "11h 15m" format as the plan total (decimals would round).
  const formatDuration = useFormatDuration();
  const show = (value: string) => (stats ? value : "—");

  return (
    <div className="space-y-1.5">
      <dl className="grid grid-cols-3 gap-3 sm:max-w-xl" aria-busy={!stats}>
        <Stat
          label={t("contentPlanner.stats.sessions")}
          value={show(formatNumber(stats?.sessions ?? 0))}
        />
        <Stat
          label={t("contentPlanner.stats.hours")}
          value={show(formatDuration(stats?.plannedMinutes ?? 0))}
        />
        <Stat
          label={t("contentPlanner.stats.done")}
          value={show(formatNumber(stats?.done ?? 0))}
        />
      </dl>
      <p className="text-xs text-text-dim">
        {t("contentPlanner.stats.caption")}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <dt className="text-xs text-text-dim">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-text tabular-nums">
        {value}
      </dd>
    </div>
  );
}
