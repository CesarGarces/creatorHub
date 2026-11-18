/**
 * Wall-clock time in an IANA time zone ⇄ instants, with `Intl` only (no
 * date library). Used where a person says "tomorrow at 3 pm": the server
 * must turn the user's local date and time into a UTC instant.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD` that exists in the calendar. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d
  );
}

/** `HH:mm`, 24-hour clock. */
export function isClockTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

export interface ZonedParts {
  /** `YYYY-MM-DD` in the zone. */
  date: string;
  /** `HH:mm` in the zone. */
  time: string;
  /** English weekday name ("Thursday"). */
  weekday: string;
  /** Offset from UTC in minutes (e.g. -300 for UTC-05:00). */
  offsetMinutes: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The wall-clock date/time of `instant` in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const [y, mo, d, h, mi, s] = (
    ["year", "month", "day", "hour", "minute", "second"] as const
  ).map((t) => Number(get(t)));
  const asUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!, s!);
  const whole = Math.floor(instant.getTime() / 1000) * 1000;
  return {
    date: `${y}-${pad(mo!)}-${pad(d!)}`,
    time: `${pad(h!)}:${pad(mi!)}`,
    weekday: get("weekday"),
    offsetMinutes: Math.round((asUtc - whole) / 60_000),
  };
}

/** "UTC-05:00", "UTC+05:30", "UTC+00:00". */
export function formatUtcOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export class NonexistentLocalTimeError extends Error {
  constructor(date: string, time: string, timeZone: string) {
    super(
      `${date} ${time} doesn't exist in ${timeZone} (daylight saving time change)`,
    );
    this.name = "NonexistentLocalTimeError";
  }
}

/**
 * The instant when the clocks of `timeZone` show `date` `time`.
 * Ambiguous times (clocks set back) resolve to the first occurrence;
 * times skipped by a DST jump throw `NonexistentLocalTimeError`.
 */
export function zonedDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  if (!isIsoDate(date)) throw new RangeError(`Invalid date: ${date}`);
  if (!isClockTime(time)) throw new RangeError(`Invalid time: ${time}`);
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError(`Invalid time zone: ${timeZone}`);
  }
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);

  // Two passes settle the offset across DST boundaries; try both offsets
  // around the wall time and keep the earliest that reads back correctly.
  const candidates = new Set<number>();
  for (const probe of [wall - 86_400_000, wall, wall + 86_400_000]) {
    const offset = zonedParts(new Date(probe), timeZone).offsetMinutes;
    candidates.add(wall - offset * 60_000);
  }
  const matches = [...candidates]
    .filter((utc) => {
      const back = zonedParts(new Date(utc), timeZone);
      return back.date === date && back.time === time;
    })
    .sort((a, b) => a - b);
  if (matches.length === 0) {
    throw new NonexistentLocalTimeError(date, time, timeZone);
  }
  return new Date(matches[0]!);
}

/** `date` plus `days` days (calendar arithmetic on `YYYY-MM-DD`). */
export function addDaysToIsoDate(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, mo - 1, d + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}
