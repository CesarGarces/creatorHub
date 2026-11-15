import { MINUTES_PER_DAY, addMinutes } from "./dates";

export type ResizeEdge = "start" | "end";

/** Grid the edges snap to, and the shortest session a resize can leave. */
export const RESIZE_STEP_MINUTES = 15;
export const MIN_SESSION_MINUTES = 15;
/** Same limit the API enforces. */
export const MAX_SESSION_MINUTES = 24 * 60;

export interface ResizeInput {
  start: Date;
  end: Date;
  /** Which edge is being dragged: the top (start) or the bottom (end). */
  edge: ResizeEdge;
  /** Pointer movement converted to minutes (positive = downwards). */
  deltaMinutes: number;
  /** Midnight of the day column being edited; edges stay inside it. */
  day: Date;
}

/**
 * New start/end after dragging one edge of a session in the week grid.
 *
 * - The dragged edge snaps to the 15-minute grid of the day, so an
 *   unaligned 10:07 becomes 10:00 / 10:15 once it moves. Movements smaller
 *   than half a step leave the session untouched.
 * - The other edge never moves, so the session keeps its place.
 * - At least 15 minutes long, at most 24 hours, and the dragged edge stays
 *   within the day column (00:00 – 24:00).
 */
export function resizeSession(input: ResizeInput): { start: Date; end: Date } {
  const { start, end, edge, deltaMinutes, day } = input;
  if (Math.abs(deltaMinutes) < RESIZE_STEP_MINUTES / 2) {
    return { start, end };
  }

  const dayStart = day.getTime();
  const minuteOf = (d: Date) => (d.getTime() - dayStart) / 60_000;
  const snap = (m: number) =>
    Math.round(m / RESIZE_STEP_MINUTES) * RESIZE_STEP_MINUTES;
  const startMin = minuteOf(start);
  const endMin = minuteOf(end);

  if (edge === "end") {
    const lowest = startMin + MIN_SESSION_MINUTES;
    const highest = Math.min(MINUTES_PER_DAY, startMin + MAX_SESSION_MINUTES);
    const next = clamp(snap(endMin + deltaMinutes), lowest, highest);
    return { start, end: addMinutes(day, next) };
  }

  const lowest = Math.max(0, endMin - MAX_SESSION_MINUTES);
  const highest = endMin - MIN_SESSION_MINUTES;
  const next = clamp(snap(startMin + deltaMinutes), lowest, highest);
  return { start: addMinutes(day, next), end };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
