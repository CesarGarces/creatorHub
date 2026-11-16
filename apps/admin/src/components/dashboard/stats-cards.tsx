"use client";

import { Users, CreditCard, UserCheck, Star } from "lucide-react";
import type { DashboardStats } from "@/types";
import { useI18n } from "@/i18n/i18n-provider";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { t, formatNumber } = useI18n();
  const cards = [
    {
      label: t("dashboard.stats.totalUsers"),
      value: stats.totalUsers,
      sub: t("dashboard.stats.activeCount", { count: stats.activeUsers }),
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: t("dashboard.stats.activeUsers"),
      value: stats.activeUsers,
      sub: t("dashboard.stats.inactiveCount", { count: stats.inactiveUsers }),
      icon: UserCheck,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      label: t("dashboard.stats.creditsUsed"),
      value: stats.totalCreditsUsed,
      sub: t("dashboard.stats.remaining", {
        count: stats.totalCreditsRemaining,
      }),
      icon: CreditCard,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: t("dashboard.stats.totalFavorites"),
      value: stats.totalFavorites,
      sub: t("dashboard.stats.toolsFavorited"),
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="min-w-0 rounded-xl border border-border bg-surface p-4 sm:p-6 transition-all hover:border-border/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-text-muted">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl sm:text-3xl font-bold text-text tabular-nums">
                  {formatNumber(card.value)}
                </p>
                <p className="mt-1 text-xs text-text-dim">{card.sub}</p>
              </div>
              <div className={`shrink-0 rounded-lg ${card.bg} p-2 sm:p-3`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
