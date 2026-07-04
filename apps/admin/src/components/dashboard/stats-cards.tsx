"use client";

import { Users, CreditCard, UserCheck, Star } from "lucide-react";
import type { DashboardStats } from "@/types";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Total Users",
      value: stats.totalUsers,
      sub: `${stats.activeUsers} active`,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Active Users",
      value: stats.activeUsers,
      sub: `${stats.inactiveUsers} inactive`,
      icon: UserCheck,
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      label: "Credits Used",
      value: stats.totalCreditsUsed,
      sub: `${stats.totalCreditsRemaining} remaining`,
      icon: CreditCard,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Total Favorites",
      value: stats.totalFavorites,
      sub: "tools favorited",
      icon: Star,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-border bg-surface p-6 transition-all hover:border-border/80"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-text-muted">
                  {card.label}
                </p>
                <p className="mt-2 text-3xl font-bold text-text">
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-text-dim">{card.sub}</p>
              </div>
              <div className={`rounded-lg ${card.bg} p-3`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
