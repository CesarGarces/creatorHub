"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  LogOut,
  Layers,
  Wrench,
  Database,
  BrainCircuit,
  Mail,
  AudioLines,
  X,
} from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import type { TranslationKey } from "@/i18n/translate";
import { LanguageSwitcher } from "@/components/language-switcher";

/** Shared with the mobile top bar's menu button (`aria-controls`). */
export const ADMIN_SIDEBAR_ID = "admin-sidebar";

const navItems: {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
}[] = [
  { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/models", labelKey: "nav.models", icon: BrainCircuit },
  { href: "/voice", labelKey: "nav.voice", icon: AudioLines },
  { href: "/tools", labelKey: "nav.tools", icon: Wrench },
  { href: "/modes", labelKey: "nav.modes", icon: Layers },
  { href: "/users", labelKey: "nav.users", icon: Users },
  { href: "/credit-plans", labelKey: "nav.creditPlans", icon: CreditCard },
  { href: "/credit-emails", labelKey: "nav.creditEmails", icon: Mail },
  { href: "/database-backups", labelKey: "nav.backups", icon: Database },
];

interface SidebarProps {
  /** Drawer state below `lg` (ignored from `lg`, where it is docked). */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const asideRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus moves into the drawer while open and back to the menu button.
  useEffect(() => {
    if (mobileOpen) {
      closeButtonRef.current?.focus();
      return;
    }
    if (asideRef.current?.contains(document.activeElement)) {
      document
        .querySelector<HTMLElement>(`[aria-controls="${ADMIN_SIDEBAR_ID}"]`)
        ?.focus();
    }
  }, [mobileOpen]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    document.cookie = "admin_token=; path=/; max-age=0; SameSite=Lax";
    router.push("/login");
  };

  return (
    <aside
      ref={asideRef}
      id={ADMIN_SIDEBAR_ID}
      data-state={mobileOpen ? "open" : "closed"}
      className={cn(
        "fixed left-0 top-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col border-r border-border bg-surface",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-[transform,visibility] duration-200 ease-out",
        // Below lg: off-canvas drawer, closed by default.
        // Visibility only transitions on close (it stays visible while
        // sliding out); on open it applies at once so focus can move in.
        mobileOpen
          ? "translate-x-0 visible transition-transform shadow-2xl shadow-black/40"
          : "-translate-x-full invisible",
        // lg+: docked, as before.
        "lg:w-64 lg:max-w-none lg:translate-x-0 lg:visible lg:shadow-none lg:pt-0 lg:pb-0",
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <span className="truncate text-lg font-bold text-text">
          {t("common.appName")}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onMobileClose}
          aria-label={t("nav.closeMenu")}
          className="lg:hidden -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-elevated hover:text-text"
        >
          <X size={20} />
        </button>
      </div>

      <nav
        aria-label={t("nav.mainNavigation")}
        className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-4"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:bg-surface-elevated hover:text-text"
              }`}
            >
              <Icon size={18} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-border p-4">
        <LanguageSwitcher
          align="start"
          className="w-full justify-start pointer-coarse:h-11"
        />
        <button
          type="button"
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-elevated hover:text-error"
        >
          <LogOut size={18} />
          {t("nav.logout")}
        </button>
      </div>
    </aside>
  );
}
