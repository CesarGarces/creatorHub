"use client";

import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import { TopBar } from "@/components/layout/top-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import { DashboardWidgets } from "@/components/dashboard-widgets/widget-grid";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";

function getGreetingKey(): TranslationKey {
  const hour = new Date().getHours();
  if (hour < 12) return "dashboard.greeting.morning";
  if (hour < 18) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

const toolbarButton =
  "flex h-9 min-w-9 items-center justify-center gap-2 rounded-lg border text-sm transition-colors pointer-coarse:h-11 pointer-coarse:min-w-11 sm:px-3";

/**
 * The dashboard: a greeting and the user's widgets (favorites, activity,
 * recommendations…), which they choose in Settings → Dashboard and
 * rearrange here by pressing and holding one (ARCHITECTURE.md §2f).
 */
export default function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { fetchBalance } = useCreditsStore();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

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

  return (
    <>
      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      <TopBar
        breadcrumbs={[{ label: t("nav.dashboard") }]}
        actions={
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            aria-label={t("dashboard.search")}
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(
              toolbarButton,
              "border-border bg-surface text-text-dim hover:text-text-muted",
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span className="hidden sm:inline">{t("dashboard.search")}</span>
            {/* Keyboard hint only where there is a keyboard. */}
            <kbd className="ml-2 hidden rounded border border-border bg-surface-elevated px-1 py-0.5 text-[10px] font-mono pointer-fine:sm:inline">
              ⌘K
            </kbd>
          </button>
        }
      />
      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 animate-fade-in">
        {/* Greeting + rearranging toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-text">
              {t(getGreetingKey(), {
                name: user?.name || user?.email?.split("@")[0] || "",
              })}
            </h1>
            <p className="mt-1 text-text-muted">{t("dashboard.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            aria-pressed={editing}
            aria-label={t("dashboard.layout.customizeLabel")}
            className={cn(
              toolbarButton,
              "mt-0.5 shrink-0",
              editing
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-text-dim hover:text-text-muted",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {t("dashboard.layout.customize")}
            </span>
          </button>
        </div>

        <DashboardWidgets editing={editing} onEditingChange={setEditing} />
      </div>
    </>
  );
}
