"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth.store";
import { useToolsStore } from "@/store/tools.store";
import { useCreditsStore } from "@/store/credits.store";
import { useChatStore } from "@/store/chat.store";
import { ToolCard, CreditDisplay, EmptyState, Badge } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import api from "@/lib/api";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = 60_000;
  const hr = 3_600_000;
  if (diff < min) return "Just now";
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / hr)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  toolName: string | null;
  toolIcon: string | null;
  provider: string | null;
  referenceId: string | null;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { tools, fetchTools } = useToolsStore();
  const { balance, fetchBalance } = useCreditsStore();
  const { sendMessage, isStreaming, openWidget } = useChatStore();
  const [quickPrompt, setQuickPrompt] = useState("");
  const [cmdOpen, setCmdOpen] = useState(false);

  const { data: transactions } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.get<Transaction[]>("/credits/transactions"),
  });

  const recentActivity = (transactions || []).slice(0, 5);

  function getPaymentStatusInfo(tx: Transaction) {
    if (tx.type !== "PURCHASE" || !tx.referenceId) return null;
    const isPending = tx.description?.toLowerCase().includes("pending");
    return {
      isPending,
      label: isPending ? "Pending" : "Completed",
      color: isPending
        ? "bg-warning/10 text-warning border-warning/30"
        : "bg-success/10 text-success border-success/30",
    };
  }

  useEffect(() => {
    fetchTools();
    fetchBalance();
  }, [fetchTools, fetchBalance]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const recentTools = tools.slice(0, 4);

  return (
    <>
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <TopBar
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text-dim hover:text-text-muted transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span>Search...</span>
            <kbd className="ml-2 rounded border border-border bg-surface-elevated px-1 py-0.5 text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
        }
      />
      <div className="p-6 space-y-8 animate-fade-in">
        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold text-text">
            {getGreeting()}, {user?.name || user?.email?.split("@")[0]} 👋
          </h1>
          <p className="mt-1 text-text-muted">What will you create today?</p>
        </div>

        {/* Dashboard Grid: Main Content + Chat */}
        <div className="space-y-8">
          {/* Quick Prompt */}
          <div className="relative">
            <div className="rounded-xl border border-border bg-surface p-1 shadow-lg shadow-primary/5">
              <div className="flex items-center gap-3 rounded-lg bg-surface-elevated px-4 py-3">
                <span className="text-primary">✦</span>
                <input
                  type="text"
                  value={quickPrompt}
                  onChange={(e) => setQuickPrompt(e.target.value)}
                  placeholder="Describe what you want to create..."
                  className="flex-1 bg-transparent text-sm text-text placeholder:text-text-dim outline-none"
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      quickPrompt.trim() &&
                      !isStreaming
                    ) {
                      openWidget();
                      sendMessage(quickPrompt.trim());
                      setQuickPrompt("");
                    }
                  }}
                />
                <button
                  onClick={() => {
                    if (quickPrompt.trim() && !isStreaming) {
                      openWidget();
                      sendMessage(quickPrompt.trim());
                      setQuickPrompt("");
                    }
                  }}
                  disabled={isStreaming || !quickPrompt.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isStreaming ? "Making..." : "Generate"}
                </button>
              </div>
            </div>
            <div className="absolute -bottom-6 left-4 flex gap-2 text-xs text-text-dim">
              <span>Try:</span>
              <button
                onClick={() => {
                  setQuickPrompt("Gaming thumbnail");
                }}
                className="text-primary/70 hover:text-primary transition-colors"
              >
                Gaming thumbnail
              </button>
              <span>·</span>
              <button
                onClick={() => {
                  setQuickPrompt("YouTube intro script");
                }}
                className="text-primary/70 hover:text-primary transition-colors"
              >
                YouTube intro script
              </button>
              <span>·</span>
              <button
                onClick={() => {
                  setQuickPrompt("Viral video title");
                }}
                className="text-primary/70 hover:text-primary transition-colors"
              >
                Viral video title
              </button>
            </div>
          </div>

          {/* Quick Access */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
              Quick Access
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentTools.map((tool) => (
                <ToolCard
                  key={tool.id}
                  name={tool.name}
                  description={tool.description}
                  icon={tool.icon}
                  credits={tool.creditsPerUse}
                  status={tool.status}
                  category={tool.category}
                  onClick={() => router.push(`/tools/${tool.id}`)}
                />
              ))}
              {recentTools.length === 0 && (
                <EmptyState
                  icon="🛠️"
                  title="No tools available"
                  description="Tools will appear here once they are activated."
                />
              )}
            </div>
          </div>

          {/* Recent History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim">
                Recent Activity
              </h2>
              <button
                onClick={() => router.push("/history")}
                className="text-xs text-primary hover:text-primary-hover transition-colors"
              >
                View all →
              </button>
            </div>
            <div className="rounded-xl border border-border bg-surface divide-y divide-border">
              {recentActivity.map((tx) => {
                const paymentStatus = getPaymentStatusInfo(tx);
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm ${
                        tx.type === "USAGE"
                          ? "bg-surface-elevated"
                          : tx.type === "PURCHASE"
                            ? "bg-success/10 text-success"
                            : "bg-primary/10 text-primary"
                      }`}
                    >
                      {tx.type === "USAGE"
                        ? tx.toolIcon || "🔧"
                        : tx.type === "PURCHASE"
                          ? "💰"
                          : "🎁"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text truncate">
                          {tx.description}
                        </p>
                        {paymentStatus && (
                          <span
                            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${paymentStatus.color}`}
                          >
                            {paymentStatus.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-dim">
                        {formatTimeAgo(tx.createdAt)} · {Math.abs(tx.amount)}{" "}
                        credits
                      </p>
                    </div>
                    <Badge variant="primary" size="sm">
                      {tx.type === "USAGE"
                        ? tx.toolName || "Tool"
                        : tx.type === "PURCHASE"
                          ? "Purchase"
                          : "Bonus"}
                    </Badge>
                  </div>
                );
              })}
              {recentActivity.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-text-dim">
                  No activity yet
                </div>
              )}
            </div>
          </div>

          {/* Recommended Agents */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim mb-4">
              Recommended Agents
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div
                className="group cursor-pointer rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => router.push("/agents/youtube")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-2xl transition-colors group-hover:bg-primary/20">
                    🤖
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">YouTube Agent</h3>
                    <p className="mt-1 text-sm text-text-muted">
                      Plan, script, and optimize your YouTube content with AI
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="primary" size="sm">
                        AI Powered
                      </Badge>
                      <span className="text-xs text-text-dim">
                        Last used 2h ago
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="group cursor-pointer rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5"
                onClick={() => router.push("/agents/content")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-light text-2xl transition-colors group-hover:bg-accent/20">
                    🧠
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">Content Agent</h3>
                    <p className="mt-1 text-sm text-text-muted">
                      Repurpose your content across multiple platforms
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="accent" size="sm">
                        Multi-Platform
                      </Badge>
                      <span className="text-xs text-text-dim">New</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start gap-3">
              <span className="text-lg">💡</span>
              <div>
                <h3 className="text-sm font-semibold text-text">Pro Tip</h3>
                <p className="mt-1 text-sm text-text-muted">
                  Use negative prompts to exclude unwanted elements from your
                  generated images. For example: "no text, no watermark, no
                  blurry" for cleaner results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
