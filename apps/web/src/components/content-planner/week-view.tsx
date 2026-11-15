"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import {
  MINUTES_PER_DAY,
  addMinutes,
  isSameDay,
  minutesIntoDay,
  snapMinutes,
  startOfWeek,
  weekDays,
} from "@/lib/content-planner/dates";
import { layoutDay } from "@/lib/content-planner/layout";
import { resizeSession, type ResizeEdge } from "@/lib/content-planner/resize";
import type { ContentEvent } from "@/lib/content-planner/types";
import { eventStyle, statusClasses } from "./event-type-meta";
import { useEventTooltip } from "./event-tooltip";

const HOUR_HEIGHT = 48; // px
const GRID_HEIGHT = HOUR_HEIGHT * 24;
const CLICK_SNAP = 30; // minutes
const DRAG_SNAP = 15; // minutes
const DEFAULT_SCROLL_MINUTE = 7 * 60 + 30;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const minutesToPx = (minutes: number) => (minutes / 60) * HOUR_HEIGHT;
const pxToMinutes = (px: number) => (px / HOUR_HEIGHT) * 60;

interface WeekViewProps {
  cursor: Date;
  events: ContentEvent[];
  focusedProjectId: string | null;
  onSelectEvent: (event: ContentEvent) => void;
  onCreateAt: (start: Date) => void;
  onMoveEvent: (event: ContentEvent, start: Date) => void;
  /** Called once, when the user releases an edge after resizing. */
  onResizeEvent: (event: ContentEvent, start: Date, end: Date) => void;
}

interface ResizeState {
  event: ContentEvent;
  edge: ResizeEdge;
  /** Pointer Y when the edge was grabbed. */
  originY: number;
  /** Midnight of the column the edge belongs to. */
  day: Date;
}

interface DragState {
  eventId: string;
  /** Minutes between the session start and the point where it was grabbed. */
  grabOffset: number;
  durationMinutes: number;
}

export function WeekView({
  cursor,
  events,
  focusedProjectId,
  onSelectEvent,
  onCreateAt,
  onMoveEvent,
  onResizeEvent,
}: WeekViewProps) {
  const { t, formatDate } = useI18n();
  const days = useMemo(() => weekDays(cursor), [cursor]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dropPreview, setDropPreview] = useState<{
    dayIndex: number;
    minute: number;
    duration: number;
  } | null>(null);
  const now = useNow();
  const tooltip = useEventTooltip();

  // ─── Resizing (drag the top or bottom edge of a session) ──────────────
  const resizeRef = useRef<ResizeState | null>(null);
  const [resizePreview, setResizePreview] = useState<{
    eventId: string;
    start: Date;
    end: Date;
  } | null>(null);
  // A resize ends with a click on whatever is under the pointer: swallow it
  // so it doesn't open the session or create a new one.
  const suppressClickRef = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopListeningRef.current?.(), []);

  const startResize = (
    e: React.PointerEvent,
    event: ContentEvent,
    edge: ResizeEdge,
    day: Date,
  ) => {
    if (e.button !== 0) return;
    // Don't start a move-drag, select text or open the session.
    e.preventDefault();
    e.stopPropagation();
    tooltip.hide();
    const state: ResizeState = { event, edge, originY: e.clientY, day };
    resizeRef.current = state;
    const original = {
      eventId: event.id,
      start: new Date(event.startAt),
      end: new Date(event.endAt),
    };
    let latest = original;
    setResizePreview(original);

    const onMove = (ev: PointerEvent) => {
      const next = resizeSession({
        start: original.start,
        end: original.end,
        edge,
        deltaMinutes: pxToMinutes(ev.clientY - state.originY),
        day,
      });
      if (
        next.start.getTime() !== latest.start.getTime() ||
        next.end.getTime() !== latest.end.getTime()
      ) {
        latest = { eventId: event.id, ...next };
        setResizePreview(latest);
      }
    };
    const finish = (save: boolean) => {
      stopListeningRef.current?.();
      resizeRef.current = null;
      setResizePreview(null);
      const changed =
        latest.start.getTime() !== original.start.getTime() ||
        latest.end.getTime() !== original.end.getTime();
      if (changed || !save) {
        suppressClickRef.current = true;
        setTimeout(() => (suppressClickRef.current = false), 0);
      }
      if (save && changed) onResizeEvent(event, latest.start, latest.end);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        finish(false);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    stopListeningRef.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      stopListeningRef.current = null;
    };
  };

  // Sessions as displayed: the one being resized uses its preview times.
  const displayEvents = useMemo(
    () =>
      resizePreview
        ? events.map((e) =>
            e.id === resizePreview.eventId
              ? {
                  ...e,
                  startAt: resizePreview.start.toISOString(),
                  endAt: resizePreview.end.toISOString(),
                }
              : e,
          )
        : events,
    [events, resizePreview],
  );

  const weekKey = startOfWeek(cursor).getTime();
  // Show the working day (from 07:30) whenever another week is opened.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = minutesToPx(DEFAULT_SCROLL_MINUTE);
    }
  }, [weekKey]);

  const timeLabel = (date: Date) =>
    formatDate(date, { hour: "numeric", minute: "2-digit" });

  const minuteFromPointer = (e: React.MouseEvent | React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return pxToMinutes(e.clientY - rect.top);
  };

  const handleColumnClick = (day: Date, e: React.MouseEvent) => {
    if (suppressClickRef.current) return;
    const minute = Math.floor(minuteFromPointer(e) / CLICK_SNAP) * CLICK_SNAP;
    onCreateAt(addMinutes(day, Math.min(minute, MINUTES_PER_DAY - CLICK_SNAP)));
  };

  const dropMinute = (e: React.DragEvent, drag: DragState) =>
    Math.min(
      Math.max(
        snapMinutes(minuteFromPointer(e) - drag.grabOffset, DRAG_SNAP),
        0,
      ),
      MINUTES_PER_DAY - DRAG_SNAP,
    );

  const handleDragOver = (dayIndex: number, e: React.DragEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const minute = dropMinute(e, drag);
    setDropPreview((prev) =>
      prev?.dayIndex === dayIndex && prev.minute === minute
        ? prev
        : { dayIndex, minute, duration: drag.durationMinutes },
    );
  };

  const handleDrop = (day: Date, e: React.DragEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDropPreview(null);
    if (!drag) return;
    e.preventDefault();
    const event = events.find((ev) => ev.id === drag.eventId);
    if (!event) return;
    const start = addMinutes(day, dropMinute(e, drag));
    if (start.getTime() !== new Date(event.startAt).getTime()) {
      onMoveEvent(event, start);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-border">
        <div />
        {days.map((day) => {
          const isToday = isSameDay(day, now);
          return (
            <div
              key={day.getTime()}
              className="flex flex-col items-center py-2 border-l border-border"
            >
              <span className="text-[11px] uppercase tracking-wide text-text-dim">
                {formatDate(day, { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-primary text-white" : "text-text",
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ height: "min(70vh, 720px)" }}
      >
        <div
          className="relative grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
          style={{ height: GRID_HEIGHT }}
        >
          {/* Hour labels */}
          <div className="relative">
            {HOURS.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] text-text-dim"
                style={{ top: h * HOUR_HEIGHT }}
              >
                {timeLabel(new Date(2000, 0, 1, h))}
              </span>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const positioned = layoutDay(displayEvents, day);
            const isToday = isSameDay(day, now);
            return (
              <div
                key={day.getTime()}
                data-testid={`planner-day-${dayIndex}`}
                className={cn(
                  "relative border-l border-border cursor-pointer",
                  isToday && "bg-primary/[0.03]",
                )}
                onClick={(e) => handleColumnClick(day, e)}
                onDragOver={(e) => handleDragOver(dayIndex, e)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropPreview((p) =>
                      p?.dayIndex === dayIndex ? null : p,
                    );
                  }
                }}
                onDrop={(e) => handleDrop(day, e)}
              >
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/50"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}

                {dropPreview?.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute inset-x-1 rounded-md border-2 border-dashed border-primary bg-primary/10 z-20"
                    style={{
                      top: minutesToPx(dropPreview.minute),
                      height: minutesToPx(
                        Math.min(
                          dropPreview.duration,
                          MINUTES_PER_DAY - dropPreview.minute,
                        ),
                      ),
                    }}
                  >
                    <span className="px-1.5 text-[11px] font-medium text-primary">
                      {timeLabel(addMinutes(day, dropPreview.minute))}
                    </span>
                  </div>
                )}

                {positioned.map((p) => {
                  const event = p.item;
                  const style = eventStyle(event);
                  const Icon = style.icon;
                  const start = new Date(event.startAt);
                  const end = new Date(event.endAt);
                  const height = Math.max(
                    minutesToPx(p.endMinute - p.startMinute),
                    20,
                  );
                  const dimmed =
                    focusedProjectId !== null &&
                    event.projectId !== focusedProjectId;
                  const range = `${timeLabel(start)} – ${timeLabel(end)}`;
                  const isResizing = resizePreview?.eventId === event.id;
                  const original =
                    events.find((ev) => ev.id === event.id) ?? event;
                  return (
                    <button
                      key={event.id}
                      type="button"
                      draggable={!isResizing}
                      aria-label={`${event.title}, ${range}`}
                      {...tooltip.triggerProps(original)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClickRef.current) return;
                        onSelectEvent(original);
                      }}
                      onDragStart={(e) => {
                        if (resizeRef.current) {
                          e.preventDefault();
                          return;
                        }
                        tooltip.hide();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const segmentOffset =
                          (day.getTime() - start.getTime()) / 60_000;
                        dragRef.current = {
                          eventId: event.id,
                          grabOffset:
                            pxToMinutes(e.clientY - rect.top) +
                            (p.continuesBefore ? segmentOffset : 0),
                          durationMinutes:
                            (end.getTime() - start.getTime()) / 60_000,
                        };
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", event.id);
                      }}
                      onDragEnd={() => {
                        dragRef.current = null;
                        setDropPreview(null);
                      }}
                      className={cn(
                        "group absolute z-10 flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-xs shadow-sm transition-[opacity,background-color] cursor-grab active:cursor-grabbing",
                        style.block,
                        statusClasses(event.status),
                        dimmed && "opacity-25",
                        isResizing &&
                          "z-20 opacity-100 ring-2 ring-primary shadow-lg",
                        p.continuesBefore && "rounded-t-none",
                        p.continuesAfter && "rounded-b-none",
                      )}
                      style={{
                        top: minutesToPx(p.startMinute),
                        height,
                        left: `calc(${(p.column / p.columns) * 100}% + 2px)`,
                        width: `calc(${100 / p.columns}% - 4px)`,
                      }}
                    >
                      <span className="flex items-center gap-1 font-semibold leading-tight">
                        {event.status === "DONE" ? (
                          <Check className="h-3 w-3 shrink-0" />
                        ) : (
                          <Icon className="h-3 w-3 shrink-0" />
                        )}
                        <span className="truncate">{event.title}</span>
                      </span>
                      {height >= 36 && (
                        <span className="truncate opacity-80">{range}</span>
                      )}
                      {height >= 56 && event.project && (
                        <span className="truncate opacity-60">
                          {event.project.title}
                        </span>
                      )}
                      {/* Resize handles (the edit dialog is the keyboard
                          alternative). Hidden on edges that continue
                          into another day. */}
                      {!p.continuesBefore && (
                        <ResizeHandle
                          edge="start"
                          eventId={event.id}
                          onPointerDown={(e) =>
                            startResize(e, original, "start", day)
                          }
                        />
                      )}
                      {!p.continuesAfter && (
                        <ResizeHandle
                          edge="end"
                          eventId={event.id}
                          onPointerDown={(e) =>
                            startResize(e, original, "end", day)
                          }
                        />
                      )}
                    </button>
                  );
                })}

                {isToday && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
                    style={{ top: minutesToPx(minutesIntoDay(now)) }}
                    title={t("contentPlanner.calendar.now")}
                    aria-hidden
                  >
                    <span className="-ml-1 h-2 w-2 rounded-full bg-error" />
                    <span className="h-px flex-1 bg-error" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {tooltip.node}
    </div>
  );
}

function ResizeHandle({
  edge,
  eventId,
  onPointerDown,
}: {
  edge: ResizeEdge;
  eventId: string;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <span
      aria-hidden
      data-testid={`resize-${edge}-${eventId}`}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-x-0 flex h-2 cursor-ns-resize touch-none justify-center",
        edge === "start" ? "top-0 items-start" : "bottom-0 items-end",
      )}
    >
      <span className="mx-auto h-0.5 w-6 rounded-full bg-current opacity-0 transition-opacity group-hover:opacity-60" />
    </span>
  );
}

/** Current time, refreshed every minute (drives the "now" line). */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
