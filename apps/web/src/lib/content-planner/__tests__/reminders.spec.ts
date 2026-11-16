import { describe, expect, it } from "vitest";
import { translate } from "@/i18n/translate";
import {
  formatDurationText,
  parseSessionReminder,
  plannerUrlFor,
  reminderOptionKey,
  reminderToValue,
  sessionReminderText,
  valueToReminder,
  type SessionReminderData,
} from "../reminders";

// Local times, so the expectations hold in any time zone.
const start = new Date(2026, 2, 4, 10, 0); // Wed 4 March 2026, 10:00
const minutesBefore = (m: number) => new Date(start.getTime() - m * 60_000);

const data: SessionReminderData = {
  kind: "session-reminder",
  eventId: "e1",
  eventTitle: "Record intro",
  startAt: start.toISOString(),
  endAt: new Date(2026, 2, 4, 12, 0).toISOString(),
  reminderMinutes: 15,
};

describe("parseSessionReminder", () => {
  it("accepts session reminders and rejects anything else", () => {
    expect(parseSessionReminder({ type: "SESSION_REMINDER", data })).toEqual(
      data,
    );
    expect(parseSessionReminder({ type: "ASSET_LIKE", data })).toBeNull();
    expect(
      parseSessionReminder({ type: "SESSION_REMINDER", data: null }),
    ).toBeNull();
    expect(
      parseSessionReminder({
        type: "SESSION_REMINDER",
        data: { ...data, startAt: "soon" },
      }),
    ).toBeNull();
  });
});

describe("sessionReminderText", () => {
  it("says when the session is, in English, for today", () => {
    expect(
      sessionReminderText(data, minutesBefore(15), "en", minutesBefore(15)),
    ).toEqual({
      title: "Upcoming session",
      message: expect.stringMatching(
        /^You have “Record intro” at 10:00\sAM — starts in 15m$/,
      ),
    });
  });

  it("uses the user's language and 24-hour clock", () => {
    expect(
      sessionReminderText(data, minutesBefore(60), "es", minutesBefore(60)),
    ).toEqual({
      title: "Próxima sesión",
      message: "Tienes “Record intro” a las 10:00 — empieza en 1 h",
    });
  });

  it("adds the day when the session isn't today (1-day reminders)", () => {
    const dayBefore = minutesBefore(1440);
    const { message } = sessionReminderText(data, dayBefore, "en", dayBefore);
    expect(message).toMatch(
      /^You have “Record intro” at Wed, Mar 4,? 10:00\sAM — starts in 24h$/,
    );
  });

  it("counts from when it was sent, so a late poll isn't wrong", () => {
    const { message } = sessionReminderText(
      data,
      minutesBefore(12),
      "en",
      minutesBefore(12),
    );
    expect(message).toMatch(/starts in 12m$/);
  });

  it("says it's starting now for 'when it starts' reminders", () => {
    expect(sessionReminderText(data, start, "en", start).message).toMatch(
      /^“Record intro” is starting now \(10:00\sAM\)$/,
    );
    expect(sessionReminderText(data, start, "pt", start).message).toBe(
      "“Record intro” está começando agora (10:00)",
    );
  });
});

describe("helpers", () => {
  const t = (
    key: Parameters<typeof translate>[1],
    params?: Record<string, string | number>,
  ) => translate("en", key, params);

  it("formats durations", () => {
    expect(formatDurationText(45, t)).toBe("45m");
    expect(formatDurationText(120, t)).toBe("2h");
    expect(formatDurationText(1230, t)).toBe("20h 30m");
    expect(formatDurationText(-5, t)).toBe("0m");
  });

  it("maps reminder settings to select values and labels", () => {
    expect(reminderToValue(null)).toBe("none");
    expect(reminderToValue(undefined)).toBe("none");
    expect(reminderToValue(0)).toBe("0");
    expect(valueToReminder("none")).toBeNull();
    expect(valueToReminder("1440")).toBe(1440);
    expect(translate("en", reminderOptionKey(0))).toBe("When it starts");
    expect(translate("en", reminderOptionKey(60))).toBe("1 hour before");
    expect(translate("es", reminderOptionKey(null))).toBe("Sin recordatorio");
  });

  it("links to the session's week in the planner", () => {
    expect(plannerUrlFor(data)).toBe(
      `/tools/content-planner?date=${encodeURIComponent(data.startAt)}`,
    );
  });
});
