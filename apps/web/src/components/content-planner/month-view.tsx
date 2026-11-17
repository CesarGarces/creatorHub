"use client";

import { useMemo } from "react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import {
  isSameDay,
  monthGridDays,
  weekDays,
} from "@/lib/content-planner/dates";
import type { ContentEvent } from "@/lib/content-planner/types";
import { eventStyle, statusClasses } from "./event-type-meta";
import { useEventTooltip } from "./event-tooltip";

const MAX_PER_DAY = 3;

interface MonthViewProps {
  cursor: Date;
  events: ContentEvent[];
  focusedProjectId: string | null;
  onSelectEvent: (event: ContentEvent) => void;
  onCreateOnDay: (day: Date) => void;
  /** Opens the week containing the day (used by "+N more"). */
  onShowDay: (day: Date) => void;
}

export function MonthView({
  cursor,
  events,
  focusedProjectId,
  onSelectEvent,
  onCreateOnDay,
  onShowDay,
}: MonthViewProps) {
  const { t, formatDate } = useI18n();
  const tooltip = useEventTooltip();
  const days = useMemo(() => monthGridDays(cursor), [cursor]);
  const weekdayHeaders = useMemo(() => weekDays(cursor), [cursor]);
  const today = new Date();

  // Sessions are listed on the day they start.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, ContentEvent[]>();
    for (const event of events) {
      const key = new Date(event.startAt).toDateString();
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Small screens: readable day cells, scrolled sideways. */}
      <div
        data-scroll-x
        data-testid="planner-month-scroller"
        className="overflow-x-auto overscroll-x-contain"
      >
        <div className="min-w-[40rem] md:min-w-0">
          <div className="grid grid-cols-7 border-b border-border">
            {weekdayHeaders.map((day) => (
              <div
                key={day.getDay()}
                className="py-2 text-center text-[11px] uppercase tracking-wide text-text-dim"
              >
                {formatDate(day, { weekday: "short" })}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 grid-rows-6">
            {days.map((day) => {
              const dayEvents = eventsByDay.get(day.toDateString()) ?? [];
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = isSameDay(day, today);
              const hidden = dayEvents.length - MAX_PER_DAY;
              return (
                <div
                  key={day.getTime()}
                  className={cn(
                    "min-h-[96px] sm:min-h-[112px] border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-surface-elevated/40",
                    !inMonth && "bg-bg/40",
                  )}
                  onClick={() => onCreateOnDay(day)}
                >
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : inMonth
                            ? "text-text"
                            : "text-text-dim",
                      )}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, MAX_PER_DAY).map((event) => {
                      const dimmed =
                        focusedProjectId !== null &&
                        event.projectId !== focusedProjectId;
                      const time = formatDate(event.startAt, {
                        hour: "numeric",
                        minute: "2-digit",
                      });
                      return (
                        <button
                          key={event.id}
                          type="button"
                          aria-label={`${event.title}, ${time}`}
                          {...tooltip.triggerProps(event)}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent(event);
                          }}
                          className={cn(
                            "flex w-full items-center gap-1.5 rounded px-1 py-0.5 pointer-coarse:py-1 text-left text-[11px] text-text-muted hover:bg-surface-elevated hover:text-text",
                            statusClasses(event.status),
                            // Other projects: grey and quieter, still 4.5:1.
                            dimmed && "grayscale text-text-dim",
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              eventStyle(event).dot,
                            )}
                          />
                          <span className="truncate">{event.title}</span>
                        </button>
                      );
                    })}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowDay(day);
                        }}
                        className="w-full rounded px-1 text-left text-[11px] font-medium text-primary hover:underline"
                      >
                        {t("contentPlanner.calendar.more", { count: hidden })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {tooltip.node}
    </div>
  );
}
