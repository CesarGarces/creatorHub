"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  CircleAlert,
  Clapperboard,
  Loader2,
  ShieldQuestion,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@creator-hub/ui";
import type {
  AssistantActionChange,
  AssistantActionRecord,
  AssistantCalendarEvent,
  AssistantCalendarProject,
} from "@creator-hub/shared-types";
import { useI18n } from "@/i18n/i18n-provider";
import { EVENT_TYPE_STYLES } from "@/components/content-planner/event-type-meta";
import type { ContentEventType } from "@/lib/content-planner/types";
import { actionActivityKey } from "@/lib/voice-assistant/status";
import type { TranslationKey } from "@/i18n/translate";

const AGENDA_SHOWN = 4;

function typeKey(type: string): ContentEventType {
  return type in EVENT_TYPE_STYLES ? (type as ContentEventType) : "OTHER";
}

interface Tone {
  icon: LucideIcon;
  label: TranslationKey;
  /** Border + background of the card. */
  box: string;
  /** Header text color. */
  text: string;
}

const EVENT_TONES: Record<AssistantActionChange, Tone> = {
  created: {
    icon: CalendarCheck,
    label: "voiceAssistant.actions.created",
    box: "border-emerald-500/30 bg-emerald-500/5",
    text: "text-emerald-400",
  },
  updated: {
    icon: CalendarClock,
    label: "voiceAssistant.actions.updated",
    box: "border-sky-500/30 bg-sky-500/5",
    text: "text-sky-400",
  },
  deleted: {
    icon: CalendarX,
    label: "voiceAssistant.actions.deleted",
    box: "border-rose-500/30 bg-rose-500/5",
    text: "text-rose-400",
  },
};

const PROJECT_LABELS: Record<AssistantActionChange, TranslationKey> = {
  created: "voiceAssistant.actions.projectCreated",
  updated: "voiceAssistant.actions.projectUpdated",
  deleted: "voiceAssistant.actions.projectDeleted",
};

/** Waiting for the user's "yes" before deleting. */
const PENDING_TONE: Tone = {
  icon: ShieldQuestion,
  label: "voiceAssistant.actions.confirm",
  box: "border-amber-500/40 bg-amber-500/5",
  text: "text-amber-300",
};

/** "Sat, Nov 28 · 3:00 PM – 4:00 PM" in the user's language and zone. */
function useFormatters() {
  const { formatDate } = useI18n();
  const time: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  const day: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
  };
  return {
    span: (slot: { startAt: string; endAt: string }, withDay = true) => {
      const range = `${formatDate(slot.startAt, time)} – ${formatDate(slot.endAt, time)}`;
      return withDay ? `${formatDate(slot.startAt, day)} · ${range}` : range;
    },
    moment: (iso: string) =>
      `${formatDate(iso, day)} · ${formatDate(iso, time)}`,
  };
}

export interface AssistantActionCardProps {
  action: AssistantActionRecord;
  /** One line (dashboard widget). */
  compact?: boolean;
  className?: string;
}

/**
 * What Robotina did during a reply (§14g "Actions"): a session or video
 * project she created, changed or deleted, the agenda or projects she read,
 * an action in progress or failed — or a deletion waiting for the user's
 * "yes". Her voice explains the details; the card shows the result and
 * links to the planner.
 */
export function AssistantActionCard({
  action,
  compact = false,
  className,
}: AssistantActionCardProps) {
  const { t } = useI18n();
  const { span, moment } = useFormatters();
  const data = action.data;
  const pending = action.status === "needs_confirmation";
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

  const link = (url: string) =>
    compact ? null : (
      <Link
        href={url}
        className="mt-2 inline-flex min-h-8 items-center text-xs font-medium text-primary hover:text-primary-hover pointer-coarse:min-h-11"
      >
        {t("voiceAssistant.actions.openPlanner")} →
      </Link>
    );

  const header = (tone: Tone, label?: TranslationKey) => {
    const Icon = tone.icon;
    return (
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium",
          tone.text,
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t(label ?? tone.label)}
      </p>
    );
  };

  const hint = pending ? (
    <p className="mt-1.5 text-xs text-amber-200">
      {t("voiceAssistant.actions.confirmHint")}
    </p>
  ) : null;

  if (data.kind === "calendar-event") {
    // Replies saved before edits existed have no `change`: they created.
    const change = data.change ?? "created";
    const tone = pending ? PENDING_TONE : EVENT_TONES[change];
    const gone = change === "deleted";
    const style = EVENT_TYPE_STYLES[typeKey(data.event.type)];
    const Icon = style.icon;

    if (compact) {
      const ToneIcon = tone.icon;
      return (
        <Link
          href={data.url}
          data-action-status={action.status}
          className={cn(
            box,
            tone.box,
            "flex items-center gap-2 text-xs text-text transition-colors hover:border-primary/50",
          )}
        >
          <ToneIcon
            className={cn("h-4 w-4 shrink-0", tone.text)}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            <span
              className={cn("font-medium", gone && !pending && "line-through")}
            >
              {data.event.title}
            </span>
            <span className="text-text-muted"> · {span(data.event)}</span>
          </span>
        </Link>
      );
    }
    return (
      <div data-action-status={action.status} className={cn(box, tone.box)}>
        {header(tone)}
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
            <p
              className={cn(
                "text-sm font-medium text-text",
                gone && !pending && "line-through",
              )}
            >
              {data.event.title}
            </p>
            <p className="text-xs text-text-muted">
              {t(`contentPlanner.types.${typeKey(data.event.type)}`)} ·{" "}
              {span(data.event)}
            </p>
            {data.previous && (
              <p className="text-xs text-text-dim">
                {t("voiceAssistant.actions.moved", {
                  time: span(data.previous),
                })}
              </p>
            )}
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
        {hint}
        {!gone && link(data.url)}
      </div>
    );
  }

  if (data.kind === "calendar-project") {
    const base = pending ? PENDING_TONE : EVENT_TONES[data.change];
    const label = pending ? PENDING_TONE.label : PROJECT_LABELS[data.change];
    const gone = data.change === "deleted";
    const details = projectDetails(data.project, gone);
    if (compact) {
      return (
        <Link
          href={data.url}
          data-action-status={action.status}
          className={cn(
            box,
            base.box,
            "flex items-center gap-2 text-xs text-text",
          )}
        >
          <Clapperboard
            className={cn("h-4 w-4 shrink-0", base.text)}
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">
            <span
              className={cn("font-medium", gone && !pending && "line-through")}
            >
              {data.project.title}
            </span>
            <span className="text-text-muted"> · {details}</span>
          </span>
        </Link>
      );
    }
    return (
      <div data-action-status={action.status} className={cn(box, base.box)}>
        {header(base, label)}
        <div className="mt-2 flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-elevated text-text-muted">
            <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "text-sm font-medium text-text",
                gone && !pending && "line-through",
              )}
            >
              {data.project.title}
            </p>
            <p className="text-xs text-text-muted">{details}</p>
          </div>
        </div>
        {hint}
        {!gone && link(data.url)}
      </div>
    );
  }

  if (data.kind === "calendar-projects") {
    const shown = data.projects.slice(0, compact ? 2 : AGENDA_SHOWN);
    return (
      <div
        data-action-status="done"
        className={cn(box, "border-border bg-surface-elevated")}
      >
        <p className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
          <Clapperboard className="h-4 w-4" aria-hidden="true" />
          {t("voiceAssistant.actions.projects")}
        </p>
        {shown.length === 0 ? (
          <p className="mt-1.5 text-xs text-text-dim">
            {t("voiceAssistant.actions.noProjects")}
          </p>
        ) : (
          <ul className="mt-1.5 space-y-1">
            {shown.map((project) => (
              <li key={project.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 truncate text-text">
                  {project.title}
                </span>
                <span className="ml-auto shrink-0 text-text-muted">
                  {project.publishAt
                    ? moment(project.publishAt)
                    : t("voiceAssistant.actions.noPublishDate")}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data.projects.length > shown.length && (
          <p className="mt-1 text-xs text-text-dim">
            {t("voiceAssistant.actions.more", {
              count: data.projects.length - shown.length,
            })}
          </p>
        )}
        {link(data.url)}
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
          {shown.map((event: AssistantCalendarEvent) => (
            <li key={event.id} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden="true"
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  EVENT_TYPE_STYLES[typeKey(event.type)].dot,
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
      {link(data.url)}
    </div>
  );

  function projectDetails(project: AssistantCalendarProject, gone: boolean) {
    const parts = [
      project.publishAt
        ? t("voiceAssistant.actions.publishOn", {
            date: moment(project.publishAt),
          })
        : t("voiceAssistant.actions.noPublishDate"),
    ];
    if (project.sessions) {
      parts.push(
        gone
          ? t("voiceAssistant.actions.projectWithSessions", {
              count: project.sessions.total,
            })
          : t("voiceAssistant.actions.projectSessions", project.sessions),
      );
    }
    return parts.join(" · ");
  }
}
