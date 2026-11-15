import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDays,
  fromDateTimeInputs,
  monthGridDays,
  shiftCursor,
  startOfWeek,
  timeInputToMinutes,
  toDateInputValue,
  toTimeInputValue,
  visibleRange,
} from "../dates";

// Wed 4 March 2026, 15:30 local time
const wed = new Date(2026, 2, 4, 15, 30);

describe("week and month ranges", () => {
  it("starts weeks on Monday, including when the cursor is a Sunday", () => {
    expect(startOfWeek(wed)).toEqual(new Date(2026, 2, 2));
    expect(startOfWeek(new Date(2026, 2, 8, 23, 59))).toEqual(
      new Date(2026, 2, 2),
    );
  });

  it("loads the visible window for each view", () => {
    expect(visibleRange("week", wed)).toEqual({
      from: new Date(2026, 2, 2),
      to: new Date(2026, 2, 9),
    });
    // March 2026 begins on a Sunday → the grid starts Monday 23 Feb.
    expect(visibleRange("month", wed)).toEqual({
      from: new Date(2026, 1, 23),
      to: new Date(2026, 3, 6),
    });
    expect(visibleRange("agenda", wed).from).toEqual(new Date(2026, 2, 4));
  });

  it("always renders six full weeks in the month grid", () => {
    const days = monthGridDays(wed);
    expect(days).toHaveLength(42);
    expect(days[0]?.getDay()).toBe(1);
    expect(days.some((d) => d.getMonth() === 2 && d.getDate() === 31)).toBe(
      true,
    );
  });

  it("pages by week, by month (from day 1, so Jan 31 → Feb) and by agenda window", () => {
    expect(shiftCursor("week", wed, 1)).toEqual(new Date(2026, 2, 11, 15, 30));
    expect(shiftCursor("month", new Date(2026, 0, 31), 1)).toEqual(
      new Date(2026, 1, 1),
    );
    expect(shiftCursor("agenda", wed, -1)).toEqual(
      new Date(2026, 1, 2, 15, 30),
    );
  });
});

describe("form inputs", () => {
  it("round-trips local date and time input values", () => {
    expect(toDateInputValue(wed)).toBe("2026-03-04");
    expect(toTimeInputValue(new Date(2026, 2, 4, 9, 5))).toBe("09:05");
    expect(fromDateTimeInputs("2026-03-04", "15:30")).toEqual(wed);
  });

  it("rejects incomplete values", () => {
    expect(fromDateTimeInputs("", "10:00")).toBeNull();
    expect(fromDateTimeInputs("2026-03-04", "")).toBeNull();
    expect(timeInputToMinutes("10:30")).toBe(630);
    expect(timeInputToMinutes("25:00")).toBeNull();
  });
});

describe("daylight saving time", () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "Europe/Madrid"; // clocks go forward on 29 March 2026
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it("adds calendar days, not 24-hour blocks", () => {
    const next = addDays(new Date(2026, 2, 28, 10, 0), 1);
    expect(next.getDate()).toBe(29);
    expect(next.getHours()).toBe(10);
  });
});
