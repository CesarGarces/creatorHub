"use client";

import { Menu } from "lucide-react";
import { Skeleton } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Server-rendered placeholder of the signed-in app shell, shown until the
 * session is restored on the client (then DashboardLayout replaces it).
 *
 * It paints with the first HTML bytes — before any JavaScript runs — so
 * users see the app immediately instead of a blank page, and it reserves
 * the shell's exact geometry (top bar h-14, docked sidebar w-60 from `lg`)
 * so nothing jumps when the real shell takes over. No user data.
 */
export function AppShellSkeleton() {
  const { t } = useI18n();
  return (
    <div
      className="flex h-dvh overflow-hidden bg-bg"
      aria-busy="true"
      data-testid="app-shell-skeleton"
    >
      {/* Docked sidebar (lg+), as in Sidebar. */}
      <div className="hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-14 items-center border-b border-border px-4">
          <img src="/isologo_white.png" alt="" className="h-8 w-auto" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar, as in TopBar. */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/80 px-3 sm:gap-3 sm:px-4 lg:px-6">
          <span className="-ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center text-text-muted lg:hidden">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </span>
          <Skeleton className="h-4 w-28" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>

        <div role="status" className="space-y-6 p-4 sm:space-y-8 sm:p-6">
          <span className="sr-only">{t("common.status.loading")}</span>
          <div className="space-y-2">
            <Skeleton className="h-7 w-56 max-w-full" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-14 w-full rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[102px] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
