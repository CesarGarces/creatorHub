import { LOCALE_META, type Locale } from "@/i18n/config";
import {
  translate,
  type TranslationKey,
  type TranslationParams,
} from "@/i18n/translate";
import { isSameDay } from "./dates";

/** "Remind me" choices (minutes before; null = none). Mirrors the API. */
export const REMINDER_OPTIONS = [
  null,
  0,
  5,
  10,
  15,
  30,
  60,
  120,
  1440,
] as const;
export type ReminderOption = (typeof REMINDER_OPTIONS)[number];
export const DEFAULT_REMINDER_MINUTES = 15;

const OPTION_KEYS: Record<string, TranslationKey> = {
  none: "contentPlanner.reminders.options.none",
  "0": "contentPlanner.reminders.options.atStart",
  "5": "contentPlanner.reminders.options.m5",
  "10": "contentPlanner.reminders.options.m10",
  "15": "contentPlanner.reminders.options.m15",
  "30": "contentPlanner.reminders.options.m30",
  "60": "contentPlanner.reminders.options.h1",
  "120": "contentPlanner.reminders.options.h2",
  "1440": "contentPlanner.reminders.options.d1",
};

/** Select value ("none" | "15") ↔ minutes. */
export const reminderToValue = (minutes: number | null | undefined) =>
  minutes === null || minutes === undefined ? "none" : String(minutes);
export const valueToReminder = (value: string): number | null =>
  value === "none" ? null : Number(value);

export function reminderOptionKey(minutes: number | null): TranslationKey {
  return OPTION_KEYS[reminderToValue(minutes)] ?? OPTION_KEYS.none!;
}

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

/** Minutes → "20h 30m" / "45m" / "3h" (localized units). */
export function formatDurationText(totalMinutes: number, t: Translate): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours === 0) return t("contentPlanner.plan.durationM", { minutes });
  if (minutes === 0) return t("contentPlanner.plan.durationH", { hours });
  return t("contentPlanner.plan.durationHM", { hours, minutes });
}

/** What the API stores in a SESSION_REMINDER notification's `data`. */
export interface SessionReminderData {
  kind: "session-reminder";
  eventId: string;
  eventTitle: string;
  startAt: string;
  endAt: string;
  reminderMinutes: number;
  customTypeName?: string | null;
  projectTitle?: string | null;
}

export function parseSessionReminder(notification: {
  type: string;
  data?: unknown;
}): SessionReminderData | null {
  if (notification.type !== "SESSION_REMINDER") return null;
  const data = notification.data as Partial<SessionReminderData> | null;
  if (
    !data ||
    typeof data.eventTitle !== "string" ||
    typeof data.startAt !== "string" ||
    Number.isNaN(new Date(data.startAt).getTime())
  ) {
    return null;
  }
  return data as SessionReminderData;
}

/**
 * Reminder text in the user's language and local time, e.g.
 * "You have “Record intro” at 10:00 AM — starts in 15m". The server can't
 * write this itself: it doesn't know the user's time zone.
 */
export function sessionReminderText(
  data: SessionReminderData,
  sentAt: Date | string,
  locale: Locale,
  now: Date = new Date(),
): { title: string; message: string } {
  const t: Translate = (key, params) => translate(locale, key, params);
  const start = new Date(data.startAt);
  const intl = LOCALE_META[locale].intlLocale;
  const time = new Intl.DateTimeFormat(
    intl,
    isSameDay(start, now)
      ? { hour: "numeric", minute: "2-digit" }
      : {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        },
  ).format(start);

  // How long before the start it was sent (not the setting: the poll
  // may run a little late).
  const minutesLeft = Math.round(
    (start.getTime() - new Date(sentAt).getTime()) / 60_000,
  );
  const message =
    minutesLeft <= 0
      ? t("contentPlanner.reminders.startingNow", {
          title: data.eventTitle,
          time,
        })
      : t("contentPlanner.reminders.message", {
          title: data.eventTitle,
          time,
          duration: formatDurationText(minutesLeft, t),
        });
  return { title: t("contentPlanner.reminders.title"), message };
}

/** Where "Open in planner" goes: the week of the session. */
export function plannerUrlFor(data: SessionReminderData): string {
  return `/tools/content-planner?date=${encodeURIComponent(data.startAt)}`;
}
