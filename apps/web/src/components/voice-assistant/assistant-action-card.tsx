"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarDays,
  CircleAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@creator-hub/ui";
import type {
  AssistantActionRecord,
  AssistantCalendarEvent,
} from "@creator-hub/shared-types";
import { useI18n } from "@/i18n/i18n-provider";
import { EVENT_TYPE_STYLES } from "@/components/content-planner/event-type-meta";
import type { ContentEventType } from "@/lib/content-planner/types";
import { actionActivityKey } from "@/lib/voice-assistant/status";

const AGENDA_SHOWN = 4;

function typeStyle(type: string) {
  return EVENT_TYPE_STYLES[type as ContentEventType] ?? EVENT_TYPE_STYLES.OTHER;
}

/** "Sat, Nov 28 · 3:00 PM – 4:00 PM" in the user's language and zone. */
function useSpan() {
  const { formatDate } = useI18n();
  return (event: AssistantCalendarEvent, withDay = true) => {
    const time: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
    };
    const start = formatDate(event.startAt, time);
    const end = formatDate(event.endAt, time);
    const day = formatDate(event.startAt, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return withDay ? `${day} · ${start} – ${end}` : `${start} – ${end}`;
  };
}

export interface AssistantActionCardProps {
  action: AssistantActionRecord;
  /** One line (dashboard widget). */
  compact?: boolean;
  className?: string;
}

/**
 * What Robotina did during a reply (§14g "Actions"): a session added to the
 * Content Planner, the agenda she read, or an action in progress / failed.
 * Her spoken words explain the details; the card shows the result and
 * links to the planner on that week.
 */
export function AssistantActionCard({
  action,
  compact = false,
  className,
}: AssistantActionCardProps) {
  const { t } = useI18n();
  const span = useSpan();
  const data = action.data;
  const box = cn(
    "rounded-xl border text-left",
    compact ? "px-3 py-2" : "px-3.5 py-3",
    className,
  );

  if (action.status === "running") {
    return (
      <div
        role="status"
        data-action-status="running"
        className={cn(
          box,
          "flex items-center gap-2 border-border bg-surface-elevated text-xs text-text-muted",
        )}
      >
        <Loader2
          className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t(actionActivityKey(action.name))}
      </div>
    );
  }

  if (action.status === "failed" || !data) {
    return (
      <div
        data-action-status="failed"
        className={cn(
          box,
          "flex items-center gap-2 border-error/30 bg-error-light text-xs text-error",
        )}
      >
        <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("voiceAssistant.actions.failed")}
      </div>
    );
  }

  if (data.kind === "calendar-event") {
    const style = typeStyle(data.event.type);
    const Icon = style.icon;
    if (compact) {
      return (
        <Link
          href={data.url}
          data-action-status="done"
          className={cn(
            box,
            "flex items-center gap-2 border-emerald-500/30 bg-emerald-500/10 text-xs text-text hover:border-emerald-400/60 transition-colors",
          )}
        >
          <CalendarCheck
            className="h-4 w-4 shrink-0 text-emerald-400"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            <span className="font-medium">{data.event.title}</span>
            <span className="text-text-muted"> · {span(data.event)}</span>
          </span>
        </Link>
      );
    }
    return (
      <div
        data-action-status="done"
        className={cn(box, "border-emerald-500/30 bg-emerald-500/5")}
      >
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
          <CalendarCheck className="h-4 w-4" aria-hidden="true" />
          {t("voiceAssistant.actions.created")}
        </p>
        <div className="mt-2 flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
              style.block,
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text">{data.event.title}</p>
            <p className="text-xs text-text-muted">
              {t(`contentPlanner.types.${typeKey(data.event.type)}`)} ·{" "}
              {span(data.event)}
            </p>
          </div>
        </div>
        {data.conflicts.length > 0 && (
          <ul className="mt-2 space-y-1">
            {data.conflicts.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-1.5 text-xs text-amber-300"
              >
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                {t("voiceAssistant.actions.overlaps", { title: c.title })} (
                {span(c, false)})
              </li>
            ))}
          </ul>
        )}
        <Link
          href={data.url}
          className="mt-2 inline-flex min-h-8 items-center text-xs font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11"
        >
          {t("voiceAssistant.actions.openPlanner")} →
        </Link>
      </div>
    );
  }

  // calendar-agenda
  const shown = data.events.slice(0, compact ? 2 : AGENDA_SHOWN);
  return (
    <div
      data-action-status="done"
      className={cn(box, "border-border bg-surface-elevated")}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {t("voiceAssistant.actions.agenda")}
      </p>
      {shown.length === 0 ? (
        <p className="mt-1.5 text-xs text-text-dim">
          {t("voiceAssistant.actions.agendaEmpty")}
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {shown.map((event) => (
            <li key={event.id} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  typeStyle(event.type).dot,
                )}
              />
              <span className="min-w-0 truncate text-text">{event.title}</span>
              <span className="ml-auto shrink-0 tabular-nums text-text-muted">
                {data.days > 1 ? span(event) : span(event, false)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {data.events.length > shown.length && (
        <p className="mt-1 text-xs text-text-dim">
          {t("voiceAssistant.actions.more", {
            count: data.events.length - shown.length,
          })}
        </p>
      )}
      <Link
        href={data.url}
        className="mt-2 inline-flex min-h-8 items-center text-xs font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11"
      >
        {t("voiceAssistant.actions.openPlanner")} →
      </Link>
    </div>
  );
}

function typeKey(type: string): ContentEventType {
  return type in EVENT_TYPE_STYLES ? (type as ContentEventType) : "OTHER";
}
