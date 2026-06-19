"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";

const DAY = 86_400_000;
const now = Date.now();

type TimeFilter = "day" | "week" | "total";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  provider: string | null;
  referenceId: string | null;
  balance: number;
  toolName: string | null;
  toolIcon: string | null;
  model: string | null;
  createdAt: string;
}

function formatDate(iso: string) {
  const ts = new Date(iso).getTime();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2 * 86_400_000) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function HistoryPage() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("day");

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<Transaction[]>("/credits/transactions"),
  });

  const usageHistory = useMemo(() => {
    if (!transactions) return [];
    return transactions;
  }, [transactions]);

  const filtered = useMemo(() => {
    const cutoff =
      timeFilter === "day"
        ? now - DAY
        : timeFilter === "week"
          ? now - 7 * DAY
          : 0;
    return usageHistory.filter(
      (h) => new Date(h.createdAt).getTime() >= cutoff,
    );
  }, [usageHistory, timeFilter]);

  function getTransactionColor(tx: Transaction) {
    if (tx.type === "USAGE") return "bg-error/10 text-error";
    if (tx.type === "PURCHASE") return "bg-success/10 text-success";
    return "bg-primary/10 text-primary";
  }

  function getTransactionIcon(tx: Transaction) {
    if (tx.type === "USAGE") return tx.toolIcon || "🔧";
    if (tx.type === "PURCHASE") return "💰";
    return "🎁";
  }

  function getPaymentStatusBadge(tx: Transaction) {
    if (tx.type !== "PURCHASE" || !tx.referenceId) return null;
    const isPending = tx.description?.toLowerCase().includes("pending");
    if (isPending) {
      return (
        <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
        Completed
      </span>
    );
  }

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "History" },
        ]}
      />
      <div className="p-6 max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text">History</h1>
            <p className="mt-1 text-text-muted">Your tool usage</p>
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["day", "week", "total"] as TimeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  timeFilter === f
                    ? "bg-primary text-white"
                    : "bg-surface-elevated text-text-muted hover:bg-surface-elevated/80"
                }`}
              >
                {f === "day" ? "Today" : f === "week" ? "7 Days" : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Total Transactions
            </p>
            <p className="mt-1 text-2xl font-bold text-text">
              {filtered.length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Credits Spent
            </p>
            <p className="mt-1 text-2xl font-bold text-error">
              {filtered
                .filter((h) => h.amount < 0)
                .reduce((sum, h) => sum + Math.abs(h.amount), 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Credits Earned
            </p>
            <p className="mt-1 text-2xl font-bold text-success">
              {filtered
                .filter((h) => h.amount > 0)
                .reduce((sum, h) => sum + h.amount, 0)}
            </p>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="rounded-xl border border-border bg-surface flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
              Activity
            </h2>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-[28rem]">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-elevated/50 transition-colors"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm ${getTransactionColor(item)}`}
                >
                  {getTransactionIcon(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text truncate">
                      {item.description}
                    </p>
                    {getPaymentStatusBadge(item)}
                  </div>
                  <p className="text-xs text-text-dim">
                    {item.type === "USAGE"
                      ? item.toolName || "Tool"
                      : item.type === "PURCHASE"
                        ? "Purchase"
                        : "Bonus"}
                    {item.model && (
                      <span className="ml-1.5 text-text-dim/60">
                        · {item.model}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs text-text-dim whitespace-nowrap">
                  {formatDate(item.createdAt)}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums min-w-[5rem] text-right ${
                    item.amount < 0 ? "text-error" : "text-success"
                  }`}
                >
                  {item.amount > 0 ? "+" : ""}
                  {Math.abs(item.amount)} cr
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-text-dim">
                No activity in this period
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
