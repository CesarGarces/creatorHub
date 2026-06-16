"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  cn,
  CreditDisplay,
  Avatar,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from "@creator-hub/ui";
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
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative text-text-muted hover:text-text transition-colors">
              <Bell className="h-[18px] w-[18px]" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-white font-bold">
                  {notifications.length}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-semibold text-text">Notifications</h3>
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
          </PopoverContent>
        </Popover>
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
