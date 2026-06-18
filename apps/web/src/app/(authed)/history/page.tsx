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
  balance: number;
  toolName: string | null;
  toolIcon: string | null;
  createdAt: string;
}

function getToolColor(name: string | null) {
  if (!name) return "bg-surface-elevated text-text-dim";
  const key = name.toLowerCase().replace(/\s+/g, "-");
  const map: Record<string, string> = {
    "thumbnail-generator": "bg-secondary/10 text-secondary",
    "content-translator": "bg-warning/10 text-warning",
  };
  return map[key] || "bg-surface-elevated text-text-dim";
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
    return transactions.filter((tx) => tx.type === "USAGE");
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

  const totalCredits = useMemo(
    () => filtered.reduce((sum, h) => sum + Math.abs(h.amount), 0),
    [filtered],
  );

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
              Total Usage
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
              -{totalCredits}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
              Tools Used
            </p>
            <p className="mt-1 text-2xl font-bold text-text">
              {new Set(filtered.map((h) => h.toolName)).size}
            </p>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="rounded-xl border border-border bg-surface flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
              Usage
            </h2>
          </div>
          <div className="divide-y divide-border overflow-y-auto max-h-[28rem]">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-elevated/50 transition-colors"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm ${getToolColor(item.toolName)}`}
                >
                  {item.toolIcon || "🔧"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {item.description}
                  </p>
                  <p className="text-xs text-text-dim">
                    {item.toolName || "Tool"}
                  </p>
                </div>
                <span className="text-xs text-text-dim whitespace-nowrap">
                  {formatDate(item.createdAt)}
                </span>
                <span className="text-sm font-semibold tabular-nums text-error min-w-[5rem] text-right">
                  -{Math.abs(item.amount)} cr
                </span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-text-dim">
                No usage in this period
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
