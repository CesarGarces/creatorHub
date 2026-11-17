"use client";

import { startTransition, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import api from "@/lib/api";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { TopUsersTable } from "@/components/dashboard/top-users-table";
import type {
  DashboardStats,
  UsageByProvider,
  TopUser,
  FavoriteStats,
} from "@/types";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

/**
 * Chart card placeholder: same box as the chart cards (title, subtitle and
 * an h-56 / sm:h-64 plot), shown while a chart's code loads.
 */
function ChartCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6"
    >
      <div className="h-7 w-40 animate-pulse rounded bg-surface-elevated" />
      <div className="h-5 w-56 max-w-full animate-pulse rounded bg-surface-elevated" />
      <div className="mt-4 h-56 animate-pulse rounded-lg bg-surface-elevated/50 sm:mt-6 sm:h-64" />
    </div>
  );
}

// The charts (recharts) load on demand, each in its own chunk and task:
// a smaller first bundle and no single long main-thread task when the data
// arrives. Their placeholders keep the layout (no shift).
const UsageChart = dynamic(
  () => import("@/components/dashboard/usage-chart").then((m) => m.UsageChart),
  { ssr: false, loading: ChartCardSkeleton },
);
const FavoriteToolsChart = dynamic(
  () =>
    import("@/components/dashboard/favorite-tools-chart").then(
      (m) => m.FavoriteToolsChart,
    ),
  { ssr: false, loading: ChartCardSkeleton },
);
const RegistrationsChart = dynamic(
  () =>
    import("@/components/dashboard/registrations-chart").then(
      (m) => m.RegistrationsChart,
    ),
  { ssr: false, loading: ChartCardSkeleton },
);

export default function DashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usage, setUsage] = useState<UsageByProvider[]>([]);
  const [favorites, setFavorites] = useState<FavoriteStats[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, usageRes, favoritesRes, topUsersRes] =
          await Promise.all([
            api.get("/admin/dashboard/stats"),
            api.get("/admin/dashboard/usage"),
            api.get("/admin/dashboard/favorites"),
            api.get("/admin/dashboard/top-users"),
          ]);

        // A transition: React renders the dashboard in small, interruptible
        // chunks instead of one long task that would block input.
        startTransition(() => {
          setStats(statsRes.data);
          setUsage(usageRes.data?.byProvider || []);
          setFavorites(favoritesRes.data?.byTool || []);
          setTopUsers(topUsersRes.data?.users || []);
          setLoading(false);
        });
      } catch (err: unknown) {
        setError(localizeError(err, "dashboard.loadFailed"));
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-border bg-surface animate-pulse"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-xl border border-border bg-surface animate-pulse" />
          <div className="h-80 rounded-xl border border-border bg-surface animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/30 bg-error/10 p-6 text-error">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-text">
          {t("dashboard.title")}
        </h1>
        <p className="text-text-muted">{t("dashboard.subtitle")}</p>
      </div>

      {stats && <StatsCards stats={stats} />}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <UsageChart data={usage} />
        <FavoriteToolsChart data={favorites} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <RegistrationsChart />
        <TopUsersTable users={topUsers} />
      </div>
    </div>
  );
}
