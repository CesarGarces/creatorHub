"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge, Skeleton, cn } from "@creator-hub/ui";
import api from "@/lib/api";
import { useI18n } from "@/i18n/i18n-provider";
import { WidgetHeader } from "../widget-header";

export interface ActivityTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  toolName: string | null;
  toolIcon: string | null;
  provider?: string | null;
  referenceId?: string | null;
  createdAt: string;
}

/** Rows shown; the full list is on /history. */
const LIMIT = 5;

/** The latest credit movements: tools used, purchases and bonuses. */
export function ActivityWidget() {
  const { t, formatRelativeTime } = useI18n();
  const { data: transactions, isPending } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<ActivityTransaction[]>("/credits/transactions"),
  });
  const recent = (transactions || []).slice(0, LIMIT);

  function paymentStatus(tx: ActivityTransaction) {
    if (tx.type !== "PURCHASE" || !tx.referenceId) return null;
    const pending = tx.description?.toLowerCase().includes("pending");
    return {
      label: pending
        ? t("common.status.pending")
        : t("common.status.completed"),
      color: pending
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-success/10 text-success border-success/30",
    };
  }

  return (
    <section>
      <WidgetHeader
        title={t("dashboard.recentActivity")}
        action={
          <Link
            href="/history"
            className="text-xs text-primary hover:text-primary-hover transition-colors"
          >
            {t("common.actions.viewAll")}
          </Link>
        }
      />
      <div className="rounded-xl border border-border bg-surface divide-y divide-border">
        {recent.map((tx) => {
          const status = paymentStatus(tx);
          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
            >
              <div
                aria-hidden="true"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm",
                  tx.type === "USAGE"
                    ? "bg-surface-elevated"
                    : tx.type === "PURCHASE"
                      ? "bg-success/10 text-success"
                      : "bg-primary/10 text-primary",
                )}
              >
                {tx.type === "USAGE"
                  ? tx.toolIcon || "🔧"
                  : tx.type === "PURCHASE"
                    ? "💰"
                    : "🎁"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-text">
                    {tx.description}
                  </p>
                  {status && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        status.color,
                      )}
                    >
                      {status.label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-dim">
                  {t("dashboard.activityMeta", {
                    time: formatRelativeTime(tx.createdAt),
                    count: Math.abs(tx.amount),
                  })}
                </p>
              </div>
              {/* Only where the row has room for it (also in half-width cells). */}
              <Badge
                variant="primary"
                size="sm"
                className="hidden shrink-0 min-[420px]:inline-flex"
              >
                {tx.type === "USAGE"
                  ? tx.toolName || t("dashboard.txType.tool")
                  : tx.type === "PURCHASE"
                    ? t("dashboard.txType.purchase")
                    : t("dashboard.txType.bonus")}
              </Badge>
            </div>
          );
        })}
        {isPending &&
          // Rows of the list's size while it loads.
          Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
            >
              <Skeleton className="h-9 w-9 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        {!isPending && recent.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-text-dim">
            {t("dashboard.noActivity")}
          </div>
        )}
      </div>
    </section>
  );
}
