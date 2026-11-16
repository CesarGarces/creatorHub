"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { ADMIN_SIDEBAR_ID, Sidebar } from "./sidebar";
import { useI18n } from "@/i18n/i18n-provider";

/**
 * Admin shell, mobile-first: below `lg` a sticky top bar opens the
 * navigation drawer (closed by default); from `lg` the sidebar is docked.
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  // Closed after every navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />

      {/* Drawer backdrop (below lg). */}
      <div
        aria-hidden="true"
        data-testid="mobile-nav-backdrop"
        onClick={() => setNavOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Mobile top bar. */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-sm lg:hidden">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label={t("nav.openMenu")}
          aria-controls={ADMIN_SIDEBAR_ID}
          aria-expanded={navOpen}
          data-testid="mobile-nav-trigger"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <Menu size={20} />
        </button>
        <span className="truncate text-base font-semibold text-text">
          {t("common.appName")}
        </span>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
