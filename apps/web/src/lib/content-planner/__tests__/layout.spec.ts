import { describe, expect, it } from "vitest";
import { layoutDay } from "../layout";

const day = new Date(2026, 2, 4);
const item = (
  id: string,
  from: [number, number],
  to: [number, number],
  dayOffset = 0,
) => ({
  id,
  startAt: new Date(2026, 2, 4, ...from).toISOString(),
  endAt: new Date(2026, 2, 4 + dayOffset, ...to).toISOString(),
});
const summary = (items: ReturnType<typeof layoutDay>) =>
  Object.fromEntries(items.map((p) => [p.item.id, `${p.column}/${p.columns}`]));

describe("layoutDay", () => {
  it("gives non-overlapping sessions the full width", () => {
    const result = layoutDay(
      [item("a", [9, 0], [10, 0]), item("b", [10, 0], [11, 0])],
      day,
    );
    expect(summary(result)).toEqual({ a: "0/1", b: "0/1" });
    expect(result[0]).toMatchObject({ startMinute: 540, endMinute: 600 });
  });

  it("splits overlapping sessions into columns and reuses freed columns", () => {
    const result = layoutDay(
      [
        item("long", [9, 0], [13, 0]),
        item("mid", [10, 0], [11, 0]),
        item("later", [11, 30], [12, 0]), // fits back into column 1
        item("alone", [14, 0], [15, 0]), // new cluster, full width
      ],
      day,
    );
    expect(summary(result)).toEqual({
      long: "0/2",
      mid: "1/2",
      later: "1/2",
      alone: "0/1",
    });
  });

  it("clips sessions that cross midnight and flags the continuation", () => {
    const [late] = layoutDay([item("late", [22, 0], [2, 0], 1)], day);
    expect(late).toMatchObject({
      startMinute: 1320,
      endMinute: 1440,
      continuesAfter: true,
    });

    const [next] = layoutDay(
      [item("late", [22, 0], [2, 0], 1)],
      new Date(2026, 2, 5),
    );
    expect(next).toMatchObject({
      startMinute: 0,
      endMinute: 120,
      continuesBefore: true,
    });
  });

  it("ignores sessions on other days and keeps tiny sessions from being covered", () => {
    const result = layoutDay(
      [
        item("tiny", [9, 0], [9, 5]),
        item("right-after", [9, 10], [10, 0]),
        {
          id: "tomorrow",
          startAt: new Date(2026, 2, 5, 9).toISOString(),
          endAt: new Date(2026, 2, 5, 10).toISOString(),
        },
      ],
      day,
    );
    expect(summary(result)).toEqual({ tiny: "0/2", "right-after": "1/2" });
  });
});
