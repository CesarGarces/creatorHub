"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Trash2 } from "lucide-react";
import {
  cn,
  CreditDisplay,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
} from "@creator-hub/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import { useNotificationStore } from "@/store/notification.store";
import { useSocketEvents } from "@/hooks/use-socket-events";

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
  const { user } = useAuthStore();
  const {
    balance,
    isLoading: creditsLoading,
    isHydrated: creditsHydrated,
  } = useCreditsStore();

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification,
    isHydrated,
  } = useNotificationStore();

  // Listen for real-time notifications via WebSocket
  useSocketEvents({
    onNotificationNew: (notification) => {
      addNotification(notification);
    },
  });

  const lowCredits = creditsHydrated && !creditsLoading && balance < 50;

  // Fetch notifications on mount
  useEffect(() => {
    if (user && !isHydrated) {
      fetchNotifications({ limit: 10 });
      fetchUnreadCount();
    }
  }, [user, isHydrated, fetchNotifications, fetchUnreadCount]);

  // Combine low credits notification with real notifications
  const allNotifications: {
    id: string;
    type: string;
    message: string;
    action?: string;
    actionLabel?: string;
    readAt: string | null;
    createdAt: string;
  }[] = [];

  if (lowCredits) {
    allNotifications.push({
      id: "low-credits",
      type: "CREDIT_LOW",
      message:
        balance === 0
          ? "You have no credits left. Buy more to keep generating."
          : `You have ${balance} credits remaining. Buy more to keep generating.`,
      action: "/credits",
      actionLabel: "Buy Credits",
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  // Add real notifications
  notifications.forEach((n) => {
    allNotifications.push({
      id: n.id,
      type: n.type,
      message: n.body || n.title,
      readAt: n.readAt,
      createdAt: n.createdAt,
    });
  });

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleDeleteNotification = async (id: string) => {
    await deleteNotification(id);
  };

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
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
              <span key={crumb.label} className="flex items-center gap-1.5">
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
            <button
              type="button"
              className="relative text-text-muted hover:text-text transition-colors"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] text-white font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-text-muted hover:text-text transition-colors flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>
            {allNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-muted">
                No notifications
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {allNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-3 border-b border-border last:border-0 space-y-2",
                      !n.readAt && "bg-surface-hover",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-text flex-1">{n.message}</p>
                      <div className="flex items-center gap-1">
                        {!n.readAt && n.type !== "CREDIT_LOW" && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(n.id)}
                            className="text-text-muted hover:text-text transition-colors"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {n.type !== "CREDIT_LOW" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(n.id)}
                            className="text-text-muted hover:text-error transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {n.action && (
                      <button
                        type="button"
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
      </div>
    </header>
  );
}
