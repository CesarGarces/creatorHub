/**
 * Local-time calendar helpers for the Content Planner. All functions return
 * new Date objects and work in the browser's time zone (the API stores UTC).
 * Day arithmetic uses setDate() so it stays correct across DST changes.
 */

export type PlannerView = "week" | "month" | "agenda";

export const MINUTES_PER_DAY = 24 * 60;
/** Days listed by the agenda view (and how far prev/next moves it). */
export const AGENDA_DAYS = 30;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Weeks start on Monday. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -offset);
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** The 7 days of the week containing `date`. */
export function weekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The 42 days (6 full weeks) shown by the month grid. */
export function monthGridDays(date: Date): Date[] {
  const start = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** Time window the calendar needs to load for a view. `to` is exclusive. */
export function visibleRange(
  view: PlannerView,
  cursor: Date,
): { from: Date; to: Date } {
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  if (view === "month") {
    const from = startOfWeek(startOfMonth(cursor));
    return { from, to: addDays(from, 42) };
  }
  const from = startOfDay(cursor);
  return { from, to: addDays(from, AGENDA_DAYS) };
}

/** Moves the cursor one "page" backwards (-1) or forwards (1). */
export function shiftCursor(
  view: PlannerView,
  cursor: Date,
  direction: 1 | -1,
): Date {
  if (view === "month") {
    return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
  }
  return addDays(cursor, direction * (view === "week" ? 7 : AGENDA_DAYS));
}

export function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function snapMinutes(minutes: number, step: number): number {
  return Math.round(minutes / step) * step;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for <input type="date">, in local time. */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "HH:mm" for <input type="time">, in local time. */
export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines the values of a date and a time input into a local Date. */
export function fromDateTimeInputs(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return null;
  const result = new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
  );
  return Number.isNaN(result.getTime()) ? null : result;
}

/** "HH:mm" → minutes since midnight. */
export function timeInputToMinutes(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes < MINUTES_PER_DAY ? minutes : null;
}
