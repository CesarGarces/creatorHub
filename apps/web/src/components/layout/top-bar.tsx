"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, CreditDisplay, Avatar } from "@creator-hub/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";

interface TopBarProps {
  title?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  className?: string;
}

export function TopBar({
  title,
  breadcrumbs,
  actions,
  className,
}: TopBarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { balance } = useCreditsStore();
  const [showNotifications, setShowNotifications] = useState(false);

  const lowCredits = balance < 50;
  const notifications: {
    id: string;
    message: string;
    action?: string;
    actionLabel?: string;
  }[] = [];

  if (lowCredits) {
    notifications.push({
      id: "low-credits",
      message:
        balance === 0
          ? "You have no credits left. Buy more to keep generating."
          : `You have ${balance} credits remaining. Buy more to keep generating.`,
      action: "/credits",
      actionLabel: "Buy Credits",
    });
  }

  useEffect(() => {
    if (!showNotifications) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifications(false);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-notifications]")) {
        setShowNotifications(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [showNotifications]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-border bg-surface/80 backdrop-blur-sm px-6 sticky top-0 z-40",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-text-dim">/</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="text-text-muted hover:text-text transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-text font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : (
          title && <h1 className="text-lg font-semibold text-text">{title}</h1>
        )}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div className="flex items-center gap-4">
        <CreditDisplay balance={balance} size="sm" />
        <div className="relative" data-notifications>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-text-muted hover:text-text transition-colors"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-white font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-surface shadow-xl z-50">
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold text-text">
                  Notifications
                </h3>
              </div>
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-text-muted">
                  No notifications
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 border-b border-border last:border-0 space-y-2"
                    >
                      <p className="text-sm text-text">{n.message}</p>
                      {n.action && (
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            router.push(n.action!);
                          }}
                          className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                        >
                          {n.actionLabel} →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Avatar name={user?.email || "User"} size="sm" />
          <button
            onClick={handleLogout}
            className="text-xs text-text-dim hover:text-error transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
