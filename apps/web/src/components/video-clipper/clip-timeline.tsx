"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { useSmoothedValue } from "@/hooks/use-smoothed-value";
import { formatClipTime, formatTimestamp } from "@/lib/video-clipper/format";
import {
  edgeBounds,
  moveRange,
  setRangeEdge,
} from "@/lib/video-clipper/ranges";
import type { ClipRange } from "@/lib/video-clipper/types";

export interface TimelineClip {
  id: string;
  /** 1-based position in the clip list. */
  index: number;
  start: number;
  end: number;
  score: number;
}

export interface ClipTimelineProps {
  durationSec: number;
  clips: TimelineClip[];
  activeId?: string | null;
  /** Player position (draws the playhead). */
  currentTime?: number | null;
  /** Keyframe timestamps (small ticks under the bar). */
  keyframes?: number[];
  /** Longest clip for the target platform (limits the handles). */
  maxLength?: number;
  onSelect?: (clipId: string) => void;
  /**
   * The selected clip was trimmed (handles) or moved (press and hold, then
   * drag). Without it the clip can't be edited on the timeline.
   */
  onRangeChange?: (clipId: string, range: ClipRange) => void;
  /** While editing: the time to show in the player. */
  onScrub?: (time: number) => void;
  className?: string;
}

type Edge = "start" | "end";

/** Press and hold this long on the selected clip to pick it up. */
export const LONG_PRESS_MS = 400;
/** Moving further before that means "not a long press" (tap, scroll…). */
export const LONG_PRESS_TOLERANCE_PX = 8;

/** Arrow keys: 0.5 s; with Shift: 0.1 s (fine tuning); Page Up/Down: 5 s. */
const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -0.5,
  ArrowDown: -0.5,
  ArrowRight: 0.5,
  ArrowUp: 0.5,
  PageDown: -5,
  PageUp: 5,
};

const pct = (value: number, total: number) =>
  `${Math.min(100, Math.max(0, (value / total) * 100))}%`;

interface Press {
  pointerId: number;
  x0: number;
  y0: number;
  /** The clip's range when the press started. */
  origin: TimelineClip;
  el: HTMLElement;
  timer: ReturnType<typeof setTimeout> | null;
  /** The long press fired: the clip follows the pointer. */
  moving: boolean;
}

interface Move {
  clipId: string;
  length: number;
  /** Start under the pointer (snapped); the bar glides toward it. */
  target: number;
  /** Pointer released: gliding to the final spot, then done. */
  settling: boolean;
}

/**
 * The whole video as a bar, with the detected clips as selectable segments.
 *
 * The selected clip can be edited:
 * - **trim** — drag its start/end handles (mouse, finger or pen; 44px on
 *   touch screens) or focus one and use the arrow keys;
 * - **move** — press and hold it (~0.4 s) until it lifts, then drag it
 *   along the bar; or use the arrow keys on it. While dragging the change
 *   is shown at once (optimistic) and the clip glides after the pointer at
 *   a smooth, medium speed; it is committed when the button/finger is
 *   released. Escape or a cancelled gesture puts it back.
 */
export function ClipTimeline({
  durationSec,
  clips,
  activeId = null,
  currentTime = null,
  keyframes = [],
  maxLength,
  onSelect,
  onRangeChange,
  onScrub,
  className,
}: ClipTimelineProps) {
  const { t } = useI18n();
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Edge | null>(null);

  // ── Press-and-hold to move the selected clip ────────────────────────
  const press = useRef<Press | null>(null);
  const suppressClick = useRef(false);
  const lastScrub = useRef<number | null>(null);
  const [pressing, setPressing] = useState<string | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const moveRef = useRef<Move | null>(null);
  moveRef.current = move;
  const [announcement, setAnnouncement] = useState("");
  const shownStart = useSmoothedValue(move ? move.target : null);

  // Finished gliding after the release → back to the (committed) props.
  useEffect(() => {
    if (move?.settling && shownStart === move.target) setMove(null);
  }, [move, shownStart]);

  useEffect(
    () => () => {
      if (press.current?.timer) clearTimeout(press.current.timer);
    },
    [],
  );

  // Escape while moving: put the clip back.
  useEffect(() => {
    if (!move || move.settling) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") finishPress(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (durationSec <= 0) return null;

  const editable = !!onRangeChange;
  const limits = { durationSec, maxLength };

  // Optimistic display: the moving clip where it is being dragged.
  const shown = clips.map((clip) =>
    move && clip.id === move.clipId && shownStart !== null
      ? { ...clip, start: shownStart, end: shownStart + move.length }
      : clip,
  );
  const active = shown.find((c) => c.id === activeId) ?? null;
  const movingClip = move ? shown.find((c) => c.id === move.clipId) : null;

  const secondsPerPixel = () => {
    const width = barRef.current?.getBoundingClientRect().width ?? 0;
    return width > 0 ? durationSec / width : 0;
  };

  /** Time under a pointer, from its x position on the bar. */
  const timeAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    return ((clientX - rect.left) / rect.width) * durationSec;
  };

  const scrub = (time: number) => {
    if (lastScrub.current === time) return;
    lastScrub.current = time;
    onScrub?.(time);
  };

  const announceMove = (index: number, range: ClipRange) =>
    setAnnouncement(
      t("videoClipper.clips.moved", {
        index,
        start: formatClipTime(range.start),
        end: formatClipTime(range.end),
      }),
    );

  const startMoving = (p: Press) => {
    p.timer = null;
    p.moving = true;
    try {
      p.el.setPointerCapture(p.pointerId);
    } catch {
      // Pointer already gone: the release/cancel handlers clean up.
    }
    navigator.vibrate?.(12);
    suppressClick.current = true; // the release must not select/preview
    setPressing(null);
    setMove({
      clipId: p.origin.id,
      length: p.origin.end - p.origin.start,
      target: p.origin.start,
      settling: false,
    });
    scrub(p.origin.start);
  };

  /** End of a press: commit (release) or put the clip back (cancel). */
  function finishPress(commit: boolean) {
    const p = press.current;
    press.current = null;
    setPressing(null);
    if (!p) return;
    if (p.timer) clearTimeout(p.timer);
    if (!p.moving) return; // a short press: the click selects/previews
    if (p.el.hasPointerCapture?.(p.pointerId)) {
      p.el.releasePointerCapture(p.pointerId);
    }
    const current = moveRef.current;
    if (!current) return;
    const final = commit
      ? moveRange(p.origin, current.target, durationSec)
      : { start: p.origin.start, end: p.origin.end };
    if (commit && final.start !== p.origin.start) {
      onRangeChange?.(p.origin.id, final);
      announceMove(p.origin.index, final);
    }
    scrub(final.start);
    setMove({ ...current, target: final.start, settling: true });
  }

  const onSegmentPointerDown = (
    clip: TimelineClip,
    e: PointerEvent<HTMLButtonElement>,
  ) => {
    suppressClick.current = false;
    if (!editable || clip.id !== activeId || e.button !== 0 || move) return;
    const p: Press = {
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      origin: clip,
      el: e.currentTarget,
      timer: null,
      moving: false,
    };
    p.timer = setTimeout(() => startMoving(p), LONG_PRESS_MS);
    press.current = p;
    setPressing(clip.id);
  };

  const onSegmentPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || e.pointerId !== p.pointerId) return;
    const dx = e.clientX - p.x0;
    if (!p.moving) {
      if (
        Math.abs(dx) > LONG_PRESS_TOLERANCE_PX ||
        Math.abs(e.clientY - p.y0) > LONG_PRESS_TOLERANCE_PX
      ) {
        finishPress(false);
      }
      return;
    }
    const next = moveRange(
      p.origin,
      p.origin.start + dx * secondsPerPixel(),
      durationSec,
    );
    // Optimistic: shown at once; committed on release.
    setMove((m) => (m ? { ...m, target: next.start } : m));
    scrub(next.start);
  };

  const onSegmentKeyDown = (
    clip: TimelineClip,
    e: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (!editable || clip.id !== activeId || move) return;
    const step = KEY_STEPS[e.key];
    if (step === undefined || !e.key.startsWith("Arrow")) return;
    e.preventDefault();
    const next = moveRange(
      clip,
      clip.start + (e.shiftKey ? Math.sign(step) * 0.1 : step),
      durationSec,
    );
    if (next.start === clip.start) return;
    onRangeChange?.(clip.id, next);
    onScrub?.(next.start);
    announceMove(clip.index, next);
  };

  // ── Start/end handles (trim) ─────────────────────────────────────────
  const moveEdge = (edge: Edge, value: number) => {
    if (!active) return;
    const next = setRangeEdge(active, edge, value, limits);
    if (next.start === active.start && next.end === active.end) return;
    onRangeChange?.(active.id, next);
    onScrub?.(edge === "start" ? next.start : next.end);
  };

  const handle = (edge: Edge) => {
    if (!active) return null;
    const value = edge === "start" ? active.start : active.end;
    const bounds = edgeBounds(active, edge, limits);
    const time = formatClipTime(value);
    const isDragging = dragging === edge;

    const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
      if (e.button !== 0 || move) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.focus();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragging(edge);
      onScrub?.(value);
    };
    const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
      if (dragging === edge) moveEdge(edge, timeAt(e.clientX));
    };
    const endDrag = (e: PointerEvent<HTMLSpanElement>) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setDragging(null);
    };
    const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
      let target: number | null = null;
      if (e.key === "Home") target = bounds.min;
      else if (e.key === "End") target = bounds.max;
      else if (e.key in KEY_STEPS) {
        const step = KEY_STEPS[e.key]!;
        const fine = e.shiftKey && e.key.startsWith("Arrow");
        target = value + (fine ? Math.sign(step) * 0.1 : step);
      }
      if (target === null) return;
      e.preventDefault();
      moveEdge(edge, target);
    };

    return (
      <span
        role="slider"
        tabIndex={0}
        aria-label={t(
          edge === "start"
            ? "videoClipper.clips.handleStart"
            : "videoClipper.clips.handleEnd",
          { index: active.index },
        )}
        aria-orientation="horizontal"
        aria-valuemin={bounds.min}
        aria-valuemax={bounds.max}
        aria-valuenow={Math.round(value * 10) / 10}
        aria-valuetext={time}
        data-testid={`timeline-handle-${edge}`}
        data-dragging={isDragging || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => setDragging(null)}
        onKeyDown={onKeyDown}
        style={{ left: pct(value, durationSec) }}
        className="group absolute -inset-y-1.5 z-30 flex w-6 -translate-x-1/2 cursor-ew-resize touch-none select-none items-center justify-center focus-visible:outline-none pointer-coarse:w-11"
      >
        {/* Grip: a bar with a knob; thicker while dragging or focused. */}
        <span
          aria-hidden="true"
          className={cn(
            "relative h-full w-1.5 rounded-full bg-text shadow-md shadow-black/40 ring-2 ring-primary transition-[width] duration-150 group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg",
            isDragging && "w-2",
          )}
        >
          <span className="absolute left-1/2 top-1/2 h-4 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-primary bg-text pointer-coarse:h-5 pointer-coarse:w-4" />
        </span>
        {isDragging && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[11px] text-text shadow-lg tabular-nums"
          >
            {time}
          </span>
        )}
      </span>
    );
  };

  return (
    // Room above the bar for the time labels (constant, so selecting a clip
    // doesn't shift the layout).
    <div className={cn(editable && "pt-6", className)}>
      <div
        ref={barRef}
        role="group"
        aria-label={t("videoClipper.clips.timeline")}
        className="relative h-10 rounded-lg border border-border bg-surface-elevated pointer-coarse:h-12"
      >
        {shown.map((clip) => {
          const label = t("videoClipper.clips.timelineClip", {
            index: clip.index,
            start: formatClipTime(clip.start),
            end: formatClipTime(clip.end),
          });
          const isActive = clip.id === activeId;
          const movable = editable && isActive;
          const isMoving = move?.clipId === clip.id;
          return (
            <button
              key={clip.id}
              type="button"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                onSelect?.(clip.id);
              }}
              onPointerDown={(e) => onSegmentPointerDown(clip, e)}
              onPointerMove={onSegmentPointerMove}
              onPointerUp={(e) => {
                if (press.current?.pointerId === e.pointerId) finishPress(true);
              }}
              onPointerCancel={(e) => {
                if (press.current?.pointerId === e.pointerId)
                  finishPress(false);
              }}
              onContextMenu={(e) => {
                // A long press must not open the context menu.
                if (movable) e.preventDefault();
              }}
              onKeyDown={(e) => onSegmentKeyDown(clip, e)}
              aria-label={label}
              aria-pressed={isActive}
              aria-keyshortcuts={movable ? "ArrowLeft ArrowRight" : undefined}
              title={label}
              data-testid={`timeline-clip-${clip.id}`}
              data-pressing={pressing === clip.id || undefined}
              data-moving={isMoving || undefined}
              style={{
                left: pct(clip.start, durationSec),
                width: `max(1.25rem, ${pct(clip.end - clip.start, durationSec)})`,
              }}
              className={cn(
                "absolute inset-y-1 flex items-center justify-center rounded-md border text-[11px] font-semibold tabular-nums transition-[background-color,box-shadow,scale] duration-200",
                isActive
                  ? "z-10 border-primary bg-primary text-primary-foreground"
                  : "border-primary/50 bg-primary-light text-primary hover:bg-primary/25",
                // Only the selected clip is draggable: it owns its touches.
                movable &&
                  "cursor-grab touch-none select-none [-webkit-touch-callout:none]",
                pressing === clip.id && "scale-y-90",
                isMoving &&
                  "z-20 cursor-grabbing shadow-lg shadow-black/50 ring-2 ring-text",
              )}
            >
              {clip.index}
            </button>
          );
        })}
        {currentTime !== null && (
          <span
            aria-hidden="true"
            data-testid="timeline-playhead"
            className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-text"
            style={{ left: pct(currentTime, durationSec) }}
          />
        )}
        {movingClip && (
          <span
            aria-hidden="true"
            data-testid="timeline-move-label"
            className="pointer-events-none absolute bottom-full z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[11px] text-text shadow-lg tabular-nums"
            style={{
              left: pct((movingClip.start + movingClip.end) / 2, durationSec),
            }}
          >
            {formatClipTime(movingClip.start)} –{" "}
            {formatClipTime(movingClip.end)}
          </span>
        )}
        {editable && handle("start")}
        {editable && handle("end")}
      </div>
      {keyframes.length > 0 && (
        <div aria-hidden="true" className="relative mt-1 h-1.5">
          {keyframes.map((time) => (
            <span
              key={time}
              className="absolute top-0 h-1.5 w-px bg-text-dim"
              style={{ left: pct(time, durationSec) }}
            />
          ))}
        </div>
      )}
      <div className="mt-1 flex justify-between font-mono text-[11px] text-text-dim tabular-nums">
        <span>{formatTimestamp(0)}</span>
        <span>{formatTimestamp(durationSec)}</span>
      </div>
      {active && editable && (
        <p data-testid="timeline-hint" className="mt-1 text-xs text-text-muted">
          {/* Worded for the input in use (mouse vs. touch screen). */}
          <span className="pointer-coarse:hidden">
            {t("videoClipper.clips.timelineHint")}
          </span>
          <span className="hidden pointer-coarse:inline">
            {t("videoClipper.clips.timelineHintTouch")}
          </span>
        </p>
      )}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
