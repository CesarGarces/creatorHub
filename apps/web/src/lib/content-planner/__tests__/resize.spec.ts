import { describe, expect, it } from "vitest";
import { resizeSession } from "../resize";

const day = new Date(2026, 2, 4); // Wed 4 March 2026, local midnight
const at = (h: number, m = 0, dayOffset = 0) =>
  new Date(2026, 2, 4 + dayOffset, h, m);
const hm = (d: Date) =>
  `${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function resize(
  start: Date,
  end: Date,
  edge: "start" | "end",
  deltaMinutes: number,
) {
  const r = resizeSession({ start, end, edge, deltaMinutes, day });
  return `${hm(r.start)} → ${hm(r.end)}`;
}

describe("resizeSession", () => {
  it("extends and shortens the end in 15-minute steps", () => {
    expect(resize(at(10), at(11), "end", 30)).toBe("4 10:00 → 4 11:30");
    expect(resize(at(10), at(11), "end", -22)).toBe("4 10:00 → 4 10:45"); // 10:38 → 10:45
    expect(resize(at(10), at(11), "end", 97)).toBe("4 10:00 → 4 12:30"); // 12:37 → 12:30
    expect(resize(at(10), at(11), "end", 98)).toBe("4 10:00 → 4 12:45"); // 12:38 → 12:45
  });

  it("moves the start without touching the end", () => {
    expect(resize(at(10), at(12), "start", -60)).toBe("4 09:00 → 4 12:00");
    expect(resize(at(10), at(12), "start", 45)).toBe("4 10:45 → 4 12:00");
  });

  it("ignores jitter smaller than half a step", () => {
    const start = at(10, 7);
    const end = at(11, 7);
    const r = resizeSession({ start, end, edge: "end", deltaMinutes: 7, day });
    expect(r.start).toBe(start);
    expect(r.end).toBe(end);
  });

  it("snaps an unaligned edge onto the grid once it moves", () => {
    expect(resize(at(10, 7), at(11, 7), "end", 15)).toBe("4 10:07 → 4 11:15");
  });

  it("never goes below 15 minutes", () => {
    expect(resize(at(10), at(11), "end", -300)).toBe("4 10:00 → 4 10:15");
    expect(resize(at(10), at(11), "start", 300)).toBe("4 10:45 → 4 11:00");
  });

  it("keeps the dragged edge inside the day column", () => {
    // 23:00 + 4 h stops at midnight (24:00 = 00:00 of the next day).
    expect(resize(at(22), at(23), "end", 240)).toBe("4 22:00 → 5 00:00");
    expect(resize(at(1), at(2), "start", -300)).toBe("4 00:00 → 4 02:00");
  });

  it("respects the 24-hour maximum for sessions that began the day before", () => {
    // 20:00 yesterday → 01:00 today; the bottom edge can reach 20:00 at most.
    const start = at(20, 0, -1);
    const r = resizeSession({
      start,
      end: at(1),
      edge: "end",
      deltaMinutes: 24 * 60,
      day,
    });
    expect(hm(r.end)).toBe("4 20:00");
    expect((r.end.getTime() - start.getTime()) / 3_600_000).toBe(24);
  });
});
