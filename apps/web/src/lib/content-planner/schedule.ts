import { addDays, addMinutes, isWeekend, startOfDay } from "./dates";

/** What the scheduler needs from a production step. */
export interface SchedulableStep {
  durationMinutes: number;
  enabled: boolean;
  isPublish: boolean;
}

export interface PlanInput<S extends SchedulableStep> {
  publishAt: Date;
  /** In order; the publishing step (if any) is scheduled at `publishAt`. */
  steps: S[];
  /** Start time of every work session, in minutes since midnight. */
  workStartMinutes: number;
  /** Keep work sessions off Saturdays and Sundays. */
  skipWeekends: boolean;
}

export interface PlannedSession<S extends SchedulableStep> {
  step: S;
  startAt: Date;
  endAt: Date;
}

/**
 * Schedules a video's production backwards from its publish date: the
 * publishing step happens at `publishAt`, and every other enabled step gets
 * its own day before it (one step per day, in list order, the last one
 * closest to publishing), starting at `workStartMinutes`.
 *
 * Example — publish Fri 18:00, work starts at 10:00, weekends skipped:
 *   Ideation (previous) Fri 10:00 · Scripting Mon · Recording Tue ·
 *   Editing Wed · Thumbnail Thu · Publishing Fri 18:00
 */
export function planProductionSchedule<S extends SchedulableStep>(
  input: PlanInput<S>,
): PlannedSession<S>[] {
  const enabled = input.steps.filter((s) => s.enabled && s.durationMinutes > 0);
  const publishing = enabled.find((s) => s.isPublish);
  const work = enabled.filter((s) => !s.isPublish);

  const sessions: PlannedSession<S>[] = [];
  let day = startOfDay(input.publishAt);
  for (const step of [...work].reverse()) {
    day = previousWorkingDay(day, input.skipWeekends);
    const startAt = addMinutes(day, input.workStartMinutes);
    sessions.unshift({
      step,
      startAt,
      endAt: addMinutes(startAt, step.durationMinutes),
    });
  }

  if (publishing) {
    sessions.push({
      step: publishing,
      startAt: new Date(input.publishAt),
      endAt: addMinutes(input.publishAt, publishing.durationMinutes),
    });
  }
  return sessions;
}

function previousWorkingDay(day: Date, skipWeekends: boolean): Date {
  let d = addDays(day, -1);
  while (skipWeekends && isWeekend(d)) d = addDays(d, -1);
  return d;
}
