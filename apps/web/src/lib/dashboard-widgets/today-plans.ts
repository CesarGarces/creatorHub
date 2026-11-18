import api from "@/lib/api";
import {
  addDays,
  startOfDay,
  toDateInputValue,
} from "@/lib/content-planner/dates";
import type { ContentEvent } from "@/lib/content-planner/types";

/**
 * "Plans for today" widget: the Content Planner sessions of the user's
 * current day (ARCHITECTURE.md §2f, §14e). Reads the planner's own
 * `GET /tools/content-planner/events?from&to`; "today" is the user's local
 * day, which only the browser knows — so the range is computed here.
 */
export const PLANNER_EVENTS_ENDPOINT = "/tools/content-planner/events";

const MINUTE_MS = 60_000;

/** Sessions listed in the widget; the rest is "+N more" (the planner). */
export const TODAY_PLANS_LIMIT = 5;

export interface DayRange {
  from: Date;
  to: Date;
}

/** Local midnight to the next local midnight (DST-safe: calendar days). */
export function dayRange(now: Date): DayRange {
  const from = startOfDay(now);
  return { from, to: addDays(from, 1) };
}

/** Cache key of a local day, e.g. "2026-11-17". */
export function dayKey(now: Date): string {
  return toDateInputValue(now);
}

/** The planner on the week of that moment (`?date=`, as reminders do). */
export function plannerUrlFor(date: Date | string): string {
  const iso = typeof date === "string" ? date : date.toISOString();
  return `/tools/content-planner?date=${encodeURIComponent(iso)}`;
}

/** Sessions at least partly inside the range (tolerates any body shape). */
export async function fetchPlans(range: DayRange): Promise<ContentEvent[]> {
  const response = await api.get<{ data?: unknown } | null>(
    PLANNER_EVENTS_ENDPOINT,
    {
      params: { from: range.from.toISOString(), to: range.to.toISOString() },
    },
  );
  return Array.isArray(response?.data) ? (response.data as ContentEvent[]) : [];
}

/** Where a session is in time, from the user's clock. */
export type PlanPhase = "upcoming" | "now" | "past";

export interface TodayPlan {
  event: ContentEvent;
  /** Happening right now (and not done yet). */
  isNow: boolean;
  phase: PlanPhase;
  /**
   * Whole minutes until it starts (`upcoming`, rounded up: never "in 0
   * min") or since it ended (`past`, rounded down: 0 = just ended); 0 while
   * it is happening.
   */
  minutes: number;
  /** Its time is over and it isn't marked done (shown in red). */
  overdue: boolean;
  /** Started on an earlier day (e.g. an overnight livestream). */
  startedBefore: boolean;
  /** Ends on a later day. */
  endsAfter: boolean;
}

/** Ties in distance: happening now, then coming up, then already passed. */
const PHASE_RANK: Record<PlanPhase, number> = { now: 0, upcoming: 1, past: 2 };

/**
 * Today's plans, **closest to the current time first**: sessions happening
 * now, then the others by how near they are — an upcoming one by the time
 * until it starts, a past one by the time since it ended. So at 10:30 a
 * session at 11:00 comes before one that ended at 9:00, which comes before
 * one at 15:00 (and a just-missed session stays near the top, in red). With
 * the widget's limit, the sessions furthest away are the ones left for
 * "+N more". Ties: now, upcoming, past; then by start time.
 *
 * Cancelled sessions are left out, done ones stay (the day's progress),
 * sessions crossing midnight are kept and marked.
 */
export function selectTodayPlans(
  events: readonly ContentEvent[],
  now: Date,
): TodayPlan[] {
  const { from, to } = dayRange(now);
  const at = now.getTime();
  return events
    .map((event) => ({
      event,
      start: new Date(event.startAt),
      end: new Date(event.endAt),
    }))
    .filter(
      ({ event, start, end }) =>
        event.status !== "CANCELLED" &&
        !Number.isNaN(start.getTime()) &&
        start < to &&
        end > from,
    )
    .map(({ event, start, end }) => {
      const phase: PlanPhase =
        start > now ? "upcoming" : end <= now ? "past" : "now";
      // Exact distance (ms) for ordering; whole minutes for display.
      const distance =
        phase === "upcoming"
          ? start.getTime() - at
          : phase === "past"
            ? at - end.getTime()
            : 0;
      const minutes =
        phase === "upcoming"
          ? Math.ceil(distance / MINUTE_MS)
          : phase === "past"
            ? Math.floor(distance / MINUTE_MS)
            : 0;
      const plan: TodayPlan = {
        event,
        isNow: event.status !== "DONE" && phase === "now",
        phase,
        minutes,
        overdue: phase === "past" && event.status !== "DONE",
        startedBefore: start < from,
        endsAfter: end > to,
      };
      return { plan, distance, start: start.getTime() };
    })
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        PHASE_RANK[a.plan.phase] - PHASE_RANK[b.plan.phase] ||
        a.start - b.start,
    )
    .map(({ plan }) => plan);
}

/** 90 → { hours: 1, minutes: 30 }, for "1 h 30 min". */
export function splitMinutes(total: number): {
  hours: number;
  minutes: number;
} {
  const safe = Math.max(0, Math.floor(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}
