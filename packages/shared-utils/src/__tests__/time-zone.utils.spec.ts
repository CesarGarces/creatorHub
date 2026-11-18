import { describe, expect, it } from "vitest";
import {
  NonexistentLocalTimeError,
  addDaysToIsoDate,
  formatUtcOffset,
  isClockTime,
  isIsoDate,
  isValidTimeZone,
  zonedDateTimeToUtc,
  zonedParts,
} from "../time-zone.utils";

describe("time-zone utils", () => {
  it("validates time zones, dates and clock times", () => {
    expect(isValidTimeZone("America/Bogota")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isClockTime("09:05")).toBe(true);
    expect(isClockTime("24:00")).toBe(false);
    expect(isClockTime("9:05")).toBe(false);
  });

  it("turns a local date and time into the right instant", () => {
    expect(
      zonedDateTimeToUtc("2026-11-27", "15:00", "America/Bogota").toISOString(),
    ).toBe("2026-11-27T20:00:00.000Z");
    expect(
      zonedDateTimeToUtc("2026-07-01", "09:30", "Asia/Kolkata").toISOString(),
    ).toBe("2026-07-01T04:00:00.000Z");
    expect(zonedDateTimeToUtc("2026-01-10", "00:15", "UTC").toISOString()).toBe(
      "2026-01-10T00:15:00.000Z",
    );
  });

  it("follows daylight saving time", () => {
    // São Paulo has no DST; Madrid does (CET winter, CEST summer).
    expect(
      zonedDateTimeToUtc("2026-01-15", "10:00", "Europe/Madrid").toISOString(),
    ).toBe("2026-01-15T09:00:00.000Z");
    expect(
      zonedDateTimeToUtc("2026-07-15", "10:00", "Europe/Madrid").toISOString(),
    ).toBe("2026-07-15T08:00:00.000Z");
    // Clocks set back (01:30 happens twice in New York): the first one.
    expect(
      zonedDateTimeToUtc(
        "2026-11-01",
        "01:30",
        "America/New_York",
      ).toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("rejects times skipped by a DST jump", () => {
    // 2026-03-08 02:30 never happens in New York.
    expect(() =>
      zonedDateTimeToUtc("2026-03-08", "02:30", "America/New_York"),
    ).toThrow(NonexistentLocalTimeError);
  });

  it("reads an instant back as local parts", () => {
    expect(
      zonedParts(new Date("2026-11-27T20:04:00Z"), "America/Bogota"),
    ).toEqual({
      date: "2026-11-27",
      time: "15:04",
      weekday: "Friday",
      offsetMinutes: -300,
    });
    expect(formatUtcOffset(-300)).toBe("UTC-05:00");
    expect(formatUtcOffset(330)).toBe("UTC+05:30");
    expect(formatUtcOffset(0)).toBe("UTC+00:00");
  });

  it("adds days across months and years", () => {
    expect(addDaysToIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToIsoDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});
