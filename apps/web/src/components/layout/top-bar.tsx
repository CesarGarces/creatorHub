"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Menu, Trash2 } from "lucide-react";
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
import { useMobileNavStore } from "@/store/mobile-nav.store";
import { SIDEBAR_ID } from "@/components/layout/sidebar";
import { useSocketEvents } from "@/hooks/use-socket-events";
import { useI18n } from "@/i18n/i18n-provider";
import { LanguageSelector } from "@/components/i18n/language-selector";
import {
  parseSessionReminder,
  sessionReminderText,
  type SessionReminderData,
} from "@/lib/content-planner/reminders";
import { openSessionInPlanner } from "@/components/content-planner/open-in-planner";

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
  const { t, locale } = useI18n();
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

  const mobileNavOpen = useMobileNavStore((s) => s.isOpen);
  const openMobileNav = useMobileNavStore((s) => s.open);

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
    /** Session reminders open their week in the planner. */
    reminder?: SessionReminderData;
    readAt: string | null;
    createdAt: string;
  }[] = [];

  if (lowCredits) {
    allNotifications.push({
      id: "low-credits",
      type: "CREDIT_LOW",
      message:
        balance === 0
          ? t("topBar.noCreditsLeft")
          : t("topBar.creditsRemaining", { count: balance }),
      action: "/credits",
      actionLabel: t("topBar.buyCredits"),
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  // Add real notifications
  notifications.forEach((n) => {
    const reminder = parseSessionReminder(n);
    if (reminder) {
      // Rendered here, in the user's language and local time.
      allNotifications.push({
        id: n.id,
        type: n.type,
        message: sessionReminderText(reminder, n.createdAt, locale).message,
        actionLabel: t("contentPlanner.reminders.open"),
        reminder,
        readAt: n.readAt,
        createdAt: n.createdAt,
      });
      return;
    }
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
        "flex h-14 items-center justify-between gap-2 border-b border-border bg-surface/80 backdrop-blur-sm px-3 sm:px-4 lg:px-6 sticky top-0 z-40",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {/* Phones & portrait tablets: opens the navigation drawer. */}
        <button
          type="button"
          onClick={openMobileNav}
          aria-label={t("nav.openMenu")}
          aria-controls={SIDEBAR_ID}
          aria-expanded={mobileNavOpen}
          data-testid="mobile-nav-trigger"
          className="lg:hidden -ml-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex min-w-0 items-center gap-1.5 text-sm">
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <span
                  key={crumb.label}
                  // Phones only show where you are; the trail from `sm`.
                  className={cn(
                    "items-center gap-1.5",
                    isLast ? "flex min-w-0" : "hidden sm:flex shrink-0",
                  )}
                >
                  {i > 0 && (
                    <span className="hidden sm:inline text-text-dim">/</span>
                  )}
                  {crumb.href ? (
                    <a
                      href={crumb.href}
                      className="truncate text-text-muted hover:text-text transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className="truncate text-text font-medium">
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          title && (
            <h1 className="truncate text-base sm:text-lg font-semibold text-text">
              {title}
            </h1>
          )
        )}
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3 lg:gap-4">
        {/* On phones the language switcher lives in the navigation drawer. */}
        <LanguageSelector compact className="hidden sm:inline-flex" />
        <CreditDisplay balance={balance} size="sm" compactOnMobile />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("topBar.openNotifications")}
              className="relative flex h-9 w-9 pointer-coarse:h-11 pointer-coarse:w-11 items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 px-0.5 items-center justify-center rounded-full bg-error-solid text-[10px] text-white font-bold">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            aria-label={t("topBar.notifications")}
            className="w-80 max-w-[calc(100vw-1rem)] p-0"
            align="end"
          >
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">
                {t("topBar.notifications")}
              </h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-text-muted hover:text-text transition-colors flex items-center gap-1"
                >
                  <Check className="h-3 w-3" />
                  {t("topBar.markAllRead")}
                </button>
              )}
            </div>
            {allNotifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-muted">
                {t("topBar.noNotifications")}
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
                            className="flex items-center justify-center rounded text-text-muted hover:text-text transition-colors pointer-coarse:h-9 pointer-coarse:w-9"
                            title={t("topBar.markAsRead")}
                            aria-label={t("topBar.markAsRead")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {n.type !== "CREDIT_LOW" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(n.id)}
                            className="flex items-center justify-center rounded text-text-muted hover:text-error transition-colors pointer-coarse:h-9 pointer-coarse:w-9"
                            title={t("topBar.delete")}
                            aria-label={t("topBar.delete")}
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
                    {n.reminder && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.readAt) void handleMarkAsRead(n.id);
                          openSessionInPlanner(n.reminder!, (url) =>
                            router.push(url),
                          );
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
