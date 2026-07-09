"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuthStore } from "@/store/auth.store";
import { useToolsStore } from "@/store/tools.store";
import type { ToolManifest } from "@creator-hub/shared-types";
import { useCreditsStore } from "@/store/credits.store";
import { useChatStore } from "@/store/chat.store";
import { useFavoritesStore } from "@/store/favorites.store";
import {
  ToolCard,
  CreditDisplay,
  EmptyState,
  Badge,
  cn,
} from "@creator-hub/ui";
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
  const { favoriteIds, fetchFavorites, toggleFavorite, reorderFavorites } =
    useFavoritesStore();
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
    fetchFavorites();
  }, [fetchTools, fetchBalance, fetchFavorites]);

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

  // Show favorite tools, or first 4 if no favorites
  const favoriteTools = useMemo(() => {
    const favTools = tools.filter((t) => favoriteIds?.includes(t.id));
    if (favTools.length === 0) return [];
    // Sort by favoriteIds order
    return favoriteIds
      .map((id) => favTools.find((t) => t.id === id))
      .filter((t): t is ToolManifest => t !== undefined);
  }, [tools, favoriteIds]);
  const recentTools =
    favoriteTools.length > 0 ? favoriteTools : tools.slice(0, 4);
  const isDraggable = favoriteTools.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = favoriteIds.indexOf(active.id as string);
    const newIndex = favoriteIds.indexOf(over.id as string);
    const newOrder = arrayMove(favoriteIds, oldIndex, newIndex);
    reorderFavorites(newOrder);
  }

  return (
    <>
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <TopBar
        breadcrumbs={[{ label: "Dashboard" }]}
        actions={
          <button
            type="button"
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
                  aria-label="Describe what you want to create"
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
                  type="button"
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
                type="button"
                onClick={() => {
                  setQuickPrompt("Gaming thumbnail");
                }}
                className="text-primary/70 hover:text-primary transition-colors"
              >
                Gaming thumbnail
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() => {
                  setQuickPrompt("YouTube intro script");
                }}
                className="text-primary/70 hover:text-primary transition-colors"
              >
                YouTube intro script
              </button>
              <span>·</span>
              <button
                type="button"
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
              {favoriteTools.length > 0
                ? "Favorite Tools — drag to reorder"
                : "Quick Access"}
            </h2>
            {isDraggable ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={favoriteIds}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {recentTools.map((tool) => (
                      <SortableToolCard
                        key={tool.id}
                        tool={tool}
                        isFavorite={favoriteIds?.includes(tool.id) ?? false}
                        onToggleFavorite={() => toggleFavorite(tool.id)}
                        onClick={() => router.push(`/tools/${tool.id}`)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
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
                    isFavorite={favoriteIds?.includes(tool.id) ?? false}
                    onToggleFavorite={() => toggleFavorite(tool.id)}
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
            )}
          </div>

          {/* Recent History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim">
                Recent Activity
              </h2>
              <button
                type="button"
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
                className="group cursor-pointer rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-500/5"
                onClick={() => router.push("/tools/x-post-tweet")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl transition-colors group-hover:bg-blue-500/20">
                    💬
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">X Post Agent</h3>
                    <p className="mt-1 text-sm text-text-muted">
                      Publish tweets and threads to your X account
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="primary" size="sm">
                        Social
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className="group cursor-pointer rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5"
                onClick={() => router.push("/tools/x-search-trends")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-2xl transition-colors group-hover:bg-cyan-500/20">
                    📡
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">
                      X Research Agent
                    </h3>
                    <p className="mt-1 text-sm text-text-muted">
                      Search and analyze trending topics on X
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="accent" size="sm">
                        Research
                      </Badge>
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

function SortableToolCard({
  tool,
  isFavorite,
  onToggleFavorite,
  onClick,
}: {
  tool: any;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tool.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms cubic-bezier(0.25, 1, 0.5, 1)",
    zIndex: isDragging ? 50 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative transition-all duration-200",
        isDragging &&
          "rounded-xl shadow-2xl shadow-primary/20 ring-2 ring-primary/30 scale-[1.03] opacity-90",
      )}
    >
      <div
        {...listeners}
        {...attributes}
        role="button"
        aria-label={`Drag to reorder ${tool.name}`}
        tabIndex={0}
        className={cn(
          "absolute -top-2 -left-2 z-20",
          "flex h-8 w-8 items-center justify-center rounded-lg",
          "bg-surface border border-border-subtle shadow-sm",
          "cursor-grab active:cursor-grabbing",
          "text-text-dim hover:text-text-muted hover:bg-surface-elevated hover:border-border hover:shadow-md",
          "transition-all duration-150 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "active:scale-90",
          isDragging &&
            "bg-primary/10 border-primary/30 text-primary shadow-lg",
        )}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="9" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="9" cy="19" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15" cy="19" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <ToolCard
        name={tool.name}
        description={tool.description}
        icon={tool.icon}
        credits={tool.creditsPerUse}
        status={tool.status}
        category={tool.category}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        onClick={onClick}
      />
    </div>
  );
}
