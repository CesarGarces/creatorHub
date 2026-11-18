"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { Badge, Skeleton, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { useMinuteClock } from "@/hooks/use-minute-clock";
import {
  eventStyle,
  statusClasses,
} from "@/components/content-planner/event-type-meta";
import { useTypeLabel } from "@/components/content-planner/use-type-label";
import { isSameDay } from "@/lib/content-planner/dates";
import {
  TODAY_PLANS_LIMIT,
  dayKey,
  dayRange,
  fetchPlans,
  plannerUrlFor,
  selectTodayPlans,
  splitMinutes,
  type TodayPlan,
} from "@/lib/dashboard-widgets/today-plans";
import { WidgetHeader } from "../widget-header";

const row = "flex items-start gap-3 px-4 py-3.5 sm:px-5";

/**
 * "Plans for today": the Content Planner sessions of the user's day,
 * closest to the current time first (`selectTodayPlans`) — each
 * with its name, its description (the session notes) and its time, in the
 * calendar's colours. On the right, the time to each session ("in 1 h 30
 * min"), "Now", or how long ago it passed — in red when its time is over
 * and it isn't done. Done sessions stay (quieter), cancelled ones are left
 * out. A session opens the planner on
 * its week. Follows the clock: "Now" moves on by itself and the list
 * switches to the new day after midnight.
 */
export function TodayPlansWidget() {
  const { t, formatDate } = useI18n();
  const typeLabel = useTypeLabel();
  const now = useMinuteClock();
  const day = dayKey(now);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["content-planner", "today-plans", day],
    queryFn: () => fetchPlans(dayRange(now)),
  });

  const plans = selectTodayPlans(data ?? [], now);
  const shown = plans.slice(0, TODAY_PLANS_LIMIT);
  const more = plans.length - shown.length;

  const time = (date: Date) =>
    isSameDay(date, now)
      ? formatDate(date, { hour: "numeric", minute: "2-digit" })
      : formatDate(date, {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
        });

  function when({ event, startedBefore, endsAfter }: TodayPlan): string {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    if (startedBefore && !endsAfter) {
      return t("dashboard.todayPlans.until", { time: time(end) });
    }
    if (endsAfter && !startedBefore) {
      return t("dashboard.todayPlans.from", { time: time(start) });
    }
    return t("dashboard.todayPlans.time", {
      start: time(start),
      end: time(end),
    });
  }

  /** 90 → "1 h 30 min", 120 → "2 h", 45 → "45 min". */
  function duration(total: number): string {
    const { hours, minutes } = splitMinutes(total);
    if (hours === 0) return t("dashboard.todayPlans.minutes", { minutes });
    if (minutes === 0) return t("dashboard.todayPlans.hours", { hours });
    return t("dashboard.todayPlans.hoursMinutes", { hours, minutes });
  }

  /** Right side of a row: time to start, "Now", or time since it passed. */
  function countdown({ phase, minutes, isNow }: TodayPlan): string | null {
    if (phase === "upcoming") {
      return t("dashboard.todayPlans.startsIn", {
        duration: duration(minutes),
      });
    }
    if (phase === "now") return isNow ? t("dashboard.todayPlans.now") : null;
    return minutes === 0
      ? t("dashboard.todayPlans.justEnded")
      : t("dashboard.todayPlans.ago", { duration: duration(minutes) });
  }

  return (
    <section>
      <WidgetHeader
        title={t("dashboard.widgets.todayPlans.name")}
        action={
          <Link
            href={plannerUrlFor(now)}
            className="text-xs text-primary hover:text-primary-hover transition-colors"
          >
            {t("dashboard.todayPlans.open")}
          </Link>
        }
      />
      <div className="rounded-xl border border-border bg-surface">
        {isPending ? (
          // Rows of the list's size while it loads.
          <div aria-hidden="true" className="divide-y divide-border">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className={row}>
                <Skeleton className="h-9 w-9 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <p className="text-sm text-text-muted">
              {t("dashboard.todayPlans.error")}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="text-xs font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11"
            >
              {t("dashboard.todayPlans.retry")}
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
            <CalendarCheck
              className="h-6 w-6 text-text-dim"
              aria-hidden="true"
            />
            <p className="text-sm text-text-dim">
              {t("dashboard.todayPlans.empty")}
            </p>
            <Link
              href={plannerUrlFor(now)}
              className="inline-flex items-center text-xs font-medium text-primary underline underline-offset-4 hover:text-primary-hover pointer-coarse:min-h-11"
            >
              {t("dashboard.todayPlans.plan")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((plan) => {
              const { event, isNow, overdue } = plan;
              const label = countdown(plan);
              const style = eventStyle(event);
              const Icon = style.icon;
              const notes = event.notes?.trim();
              // Name and description: the notes, else the video it belongs to.
              const description = notes || event.project?.title;
              return (
                <li
                  key={event.id}
                  data-plan-id={event.id}
                  data-phase={plan.phase}
                  data-overdue={overdue || undefined}
                >
                  <Link
                    href={plannerUrlFor(event.startAt)}
                    className={cn(
                      row,
                      "transition-colors hover:bg-surface-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                      statusClasses(event.status),
                      // Its time passed and it isn't done: red.
                      overdue &&
                        "relative bg-error/5 hover:bg-error/10 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-error-solid",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                        style.block,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-text">
                          {event.title}
                        </span>
                        {!isNow && event.status !== "PLANNED" && (
                          <Badge
                            variant={
                              event.status === "DONE" ? "secondary" : "accent"
                            }
                            size="sm"
                            className="shrink-0"
                          >
                            {t(`contentPlanner.statuses.${event.status}`)}
                          </Badge>
                        )}
                      </span>
                      {description && (
                        <span className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-text-muted">
                          {description}
                        </span>
                      )}
                      <span className="mt-1 block text-xs tabular-nums text-text-dim">
                        {when(plan)} · {typeLabel(event)}
                        {notes && event.project?.title
                          ? ` · ${event.project.title}`
                          : ""}
                      </span>
                    </span>
                    {label && (
                      <span
                        data-countdown
                        className={cn(
                          "shrink-0 self-center whitespace-nowrap text-xs font-medium tabular-nums",
                          plan.phase === "now"
                            ? "text-primary"
                            : overdue
                              ? "text-error"
                              : plan.phase === "past"
                                ? "text-text-dim"
                                : plan.minutes <= 15
                                  ? "text-primary"
                                  : "text-text-muted",
                        )}
                      >
                        {label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            {more > 0 && (
              <li>
                <Link
                  href={plannerUrlFor(now)}
                  className="block px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-surface-elevated/60 hover:text-primary-hover sm:px-5 pointer-coarse:py-3.5"
                >
                  {t("dashboard.todayPlans.more", { count: more })}
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
