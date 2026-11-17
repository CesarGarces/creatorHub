"use client";

import { Menu } from "lucide-react";
import { Skeleton } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Server-rendered placeholder of the admin shell, shown while AuthGuard
 * checks the session on the client. It paints with the first HTML bytes
 * (app name and menu icon included, so the first contentful paint does not
 * wait for JavaScript) and reserves the shell's geometry — mobile top bar
 * h-14, docked sidebar w-64 from `lg` — so nothing jumps afterwards.
 */
export function AdminShellSkeleton() {
  const { t } = useI18n();
  return (
    <div
      className="min-h-dvh bg-bg"
      aria-busy="true"
      data-testid="admin-shell-skeleton"
    >
      {/* Docked sidebar (lg+), as in Sidebar. */}
      <div className="fixed left-0 top-0 hidden h-dvh w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-border px-6">
          <span className="truncate text-lg font-bold text-text">
            {t("common.appName")}
          </span>
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* Mobile top bar, as in AdminLayout. */}
      <div className="sticky top-0 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 pt-[env(safe-area-inset-top)] lg:hidden">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-text-muted">
          <Menu size={20} aria-hidden="true" />
        </span>
        <span className="truncate text-base font-semibold text-text">
          {t("common.appName")}
        </span>
      </div>

      <div className="lg:pl-64">
        <div
          role="status"
          className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8"
        >
          <span className="sr-only">{t("common.loading")}</span>
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
