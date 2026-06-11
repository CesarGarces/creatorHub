"use client";

import { useState } from "react";
import { Badge, EmptyState } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";

const mockHistory = [
  { id: "1", type: "thumbnail", title: "Gaming thumbnail with neon lights", credits: 10, date: "2 min ago", icon: "🖼️", badge: "primary" as const },
  { id: "2", type: "script", title: "React tutorial script", credits: 8, date: "1 hour ago", icon: "📝", badge: "accent" as const },
  { id: "3", type: "title", title: "Top 10 React hooks for 2024", credits: 5, date: "3 hours ago", icon: "🎬", badge: "secondary" as const },
  { id: "4", type: "thumbnail", title: "Minimalist product showcase", credits: 10, date: "Yesterday", icon: "🖼️", badge: "primary" as const },
  { id: "5", type: "script", title: "YouTube channel trailer script", credits: 8, date: "Yesterday", icon: "📝", badge: "accent" as const },
];

type ViewMode = "list" | "grid";

export default function HistoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? mockHistory : mockHistory.filter((h) => h.type === filter);

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "History" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text outline-none"
            >
              <option value="all">All Types</option>
              <option value="thumbnail">Thumbnails</option>
              <option value="script">Scripts</option>
              <option value="title">Titles</option>
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1.5 text-sm ${viewMode === "list" ? "bg-primary text-white" : "bg-surface-elevated text-text-muted"}`}
              >
                ☰
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`px-3 py-1.5 text-sm ${viewMode === "grid" ? "bg-primary text-white" : "bg-surface-elevated text-text-muted"}`}
              >
                ⊞
              </button>
            </div>
          </div>
        }
      />
      <div className="p-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-text">History</h1>
          <p className="mt-1 text-text-muted">Your recent generations</p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No history yet"
            description="Your generated content will appear here."
            actionLabel="Start creating"
            onAction={() => window.location.href = "/tools"}
          />
        ) : viewMode === "list" ? (
          <div className="rounded-xl border border-border bg-surface divide-y divide-border">
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-elevated/50 transition-colors cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-elevated text-lg">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{item.title}</p>
                  <p className="text-xs text-text-dim">{item.date}</p>
                </div>
                <Badge variant={item.badge} size="sm">{item.type}</Badge>
                <span className="text-xs text-text-dim">{item.credits} cr</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-surface p-4 hover:border-border/80 transition-colors cursor-pointer">
                <div className="aspect-video rounded-lg bg-surface-elevated mb-3 flex items-center justify-center text-3xl">
                  {item.icon}
                </div>
                <p className="text-sm font-medium text-text truncate">{item.title}</p>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-text-dim">{item.date}</p>
                  <span className="text-xs text-text-dim">{item.credits} cr</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
