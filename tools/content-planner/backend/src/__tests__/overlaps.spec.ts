import { describe, expect, it } from "vitest";
import { findOverlaps, overlaps } from "../overlaps";

const at = (hhmm: string) => new Date(`2026-03-02T${hhmm}:00.000Z`);
const slot = (id: string, from: string, to: string) => ({
  id,
  startAt: at(from),
  endAt: at(to),
});

describe("overlaps", () => {
  it("detects partial and full overlaps", () => {
    expect(
      overlaps(slot("a", "10:00", "12:00"), slot("b", "11:00", "13:00")),
    ).toBe(true);
    expect(
      overlaps(slot("a", "10:00", "12:00"), slot("b", "10:30", "11:00")),
    ).toBe(true);
  });

  it("treats back-to-back sessions as not overlapping", () => {
    expect(
      overlaps(slot("a", "10:00", "11:00"), slot("b", "11:00", "12:00")),
    ).toBe(false);
    expect(
      overlaps(slot("a", "11:00", "12:00"), slot("b", "10:00", "11:00")),
    ).toBe(false);
  });
});

describe("findOverlaps", () => {
  it("returns overlapping sessions sorted by start, each once", () => {
    const candidates = [
      slot("new1", "09:00", "10:30"),
      slot("new2", "10:00", "12:00"),
    ];
    const existing = [
      slot("late", "11:30", "13:00"),
      slot("both", "10:00", "10:15"),
      slot("free", "12:00", "13:00"),
      slot("early", "08:00", "09:30"),
    ];

    expect(findOverlaps(candidates, existing).map((e) => e.id)).toEqual([
      "early",
      "both",
      "late",
    ]);
  });

  it("never reports a session as conflicting with itself", () => {
    const moved = slot("e1", "10:00", "11:00");
    expect(findOverlaps([moved], [slot("e1", "10:30", "11:30")])).toEqual([]);
  });
});
