"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { Badge, EmptyState, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { isSameDay, startOfDay } from "@/lib/content-planner/dates";
import type { ContentEvent } from "@/lib/content-planner/types";
import { eventStyle, statusClasses } from "./event-type-meta";
import { useTypeLabel } from "./use-type-label";
import { useEventTooltip } from "./event-tooltip";

interface AgendaViewProps {
  events: ContentEvent[];
  focusedProjectId: string | null;
  onSelectEvent: (event: ContentEvent) => void;
  onToggleDone: (event: ContentEvent) => void;
  onPlanVideo: () => void;
}

export function AgendaView({
  events,
  focusedProjectId,
  onSelectEvent,
  onToggleDone,
  onPlanVideo,
}: AgendaViewProps) {
  const { t, formatDate } = useI18n();
  const typeLabel = useTypeLabel();
  const tooltip = useEventTooltip();
  const today = new Date();

  const groups = useMemo(() => {
    const visible = focusedProjectId
      ? events.filter((e) => e.projectId === focusedProjectId)
      : events;
    const map = new Map<number, ContentEvent[]>();
    for (const event of visible) {
      const key = startOfDay(new Date(event.startAt)).getTime();
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [events, focusedProjectId]);

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon="🗓️"
          title={t("contentPlanner.calendar.emptyAgenda")}
          description={t("contentPlanner.calendar.emptyAgendaHint")}
          actionLabel={t("contentPlanner.actions.planVideo")}
          onAction={onPlanVideo}
        />
      </div>
    );
  }

  const time = (iso: string) =>
    formatDate(iso, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-4">
      {groups.map(([dayMs, dayEvents]) => {
        const day = new Date(dayMs);
        const isToday = isSameDay(day, today);
        return (
          <section key={dayMs}>
            <h3
              className={cn(
                "mb-2 text-xs font-semibold uppercase tracking-wider",
                isToday ? "text-primary" : "text-text-dim",
              )}
            >
              {isToday && `${t("contentPlanner.actions.today")} · `}
              {formatDate(day, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {dayEvents.map((event) => {
                const style = eventStyle(event);
                const Icon = style.icon;
                const done = event.status === "DONE";
                return (
                  <li
                    key={event.id}
                    className="flex items-center gap-3 px-3 py-3 sm:px-4"
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={
                        done
                          ? t("contentPlanner.event.markPending")
                          : t("contentPlanner.event.markDone")
                      }
                      onClick={() => onToggleDone(event)}
                      className={cn(
                        "flex h-5 w-5 pointer-coarse:h-7 pointer-coarse:w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                        done
                          ? "border-secondary bg-secondary text-primary-foreground"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {done && <Check className="h-3 w-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      {...tooltip.triggerProps(event)}
                      className={cn(
                        "flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left sm:flex-nowrap",
                        statusClasses(event.status),
                      )}
                    >
                      {/* Phones: the time sits on its own line above. */}
                      <span className="w-full shrink-0 whitespace-nowrap text-xs text-text-muted tabular-nums sm:w-36">
                        {time(event.startAt)} – {time(event.endAt)}
                      </span>
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-l-[3px]",
                          style.block,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text">
                          {event.title}
                        </span>
                        {event.project && (
                          <span className="block truncate text-xs text-text-dim">
                            {event.project.title}
                          </span>
                        )}
                      </span>
                      <Badge
                        variant="outline"
                        size="sm"
                        className="hidden sm:inline-flex"
                      >
                        {typeLabel(event)}
                      </Badge>
                      {event.status !== "PLANNED" && (
                        <Badge variant="outline" size="sm">
                          {t(`contentPlanner.statuses.${event.status}`)}
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {tooltip.node}
    </div>
  );
}
