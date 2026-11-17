import type { ClipRange } from "./types";

/** Shortest clip the trim controls allow (seconds). */
export const MIN_CLIP_SECONDS = 1;

export interface RangeLimits {
  durationSec: number;
  /** Longest clip for the target platform (optional). */
  maxLength?: number;
}

/**
 * Moves one edge of a clip by `delta` seconds. Returns null when the move
 * is impossible (outside the video, shorter than 1 s, longer than the
 * platform allows) so the control can be disabled.
 */
export function nudgeRange(
  range: ClipRange,
  edge: "start" | "end",
  delta: number,
  limits: RangeLimits,
): ClipRange | null {
  const round = (v: number) => Math.round(v * 10) / 10;
  const next =
    edge === "start"
      ? { start: round(Math.max(0, range.start + delta)), end: range.end }
      : {
          start: range.start,
          end: round(Math.min(limits.durationSec, range.end + delta)),
        };
  if (next.start === range.start && next.end === range.end) return null;
  const length = next.end - next.start;
  if (length < MIN_CLIP_SECONDS - 1e-9) return null;
  // Growing past the platform maximum is refused; shrinking is always fine.
  if (
    limits.maxLength !== undefined &&
    length > limits.maxLength + 1e-9 &&
    length > range.end - range.start
  ) {
    return null;
  }
  return next;
}

export function rangeLength(range: ClipRange): number {
  return Math.max(0, range.end - range.start);
}

export function sameRange(a: ClipRange, b: ClipRange): boolean {
  return Math.abs(a.start - b.start) < 0.05 && Math.abs(a.end - b.end) < 0.05;
}

/**
 * Where one edge of a clip may go: inside the video, leaving at least 1 s,
 * and (with a platform maximum) not longer than the platform allows.
 */
export function edgeBounds(
  range: ClipRange,
  edge: "start" | "end",
  limits: RangeLimits,
): { min: number; max: number } {
  const round = (v: number) => Math.round(v * 10) / 10;
  if (edge === "start") {
    const min =
      limits.maxLength !== undefined
        ? Math.max(0, range.end - limits.maxLength)
        : 0;
    return { min: round(min), max: round(range.end - MIN_CLIP_SECONDS) };
  }
  const max =
    limits.maxLength !== undefined
      ? Math.min(limits.durationSec, range.start + limits.maxLength)
      : limits.durationSec;
  return { min: round(range.start + MIN_CLIP_SECONDS), max: round(max) };
}

/** Puts one edge at `value` (e.g. under the pointer), snapped to 0.1 s and clamped. */
export function setRangeEdge(
  range: ClipRange,
  edge: "start" | "end",
  value: number,
  limits: RangeLimits,
): ClipRange {
  const { min, max } = edgeBounds(range, edge, limits);
  const snapped = Math.min(max, Math.max(min, Math.round(value * 10) / 10));
  return edge === "start"
    ? { start: snapped, end: range.end }
    : { start: range.start, end: snapped };
}

/**
 * The clip moved so it starts at `start` (e.g. dragged along the timeline):
 * same length, snapped to 0.1 s, kept inside the video.
 */
export function moveRange(
  range: ClipRange,
  start: number,
  durationSec: number,
): ClipRange {
  const length = range.end - range.start;
  const latest = Math.max(0, durationSec - length);
  const snapped = Math.min(latest, Math.max(0, Math.round(start * 10) / 10));
  return {
    start: snapped,
    end: Math.round((snapped + length) * 100) / 100,
  };
}
