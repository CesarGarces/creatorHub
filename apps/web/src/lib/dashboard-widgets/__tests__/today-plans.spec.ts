import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn() },
}));

import api from "@/lib/api";
import type { ContentEvent } from "@/lib/content-planner/types";
import {
  dayKey,
  dayRange,
  fetchPlans,
  plannerUrlFor,
  selectTodayPlans,
  splitMinutes,
} from "../today-plans";

const apiMock = vi.mocked(api);

/** Local time, like the user's clock. */
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute);

const session = (
  id: string,
  start: Date,
  end: Date,
  extra: Partial<ContentEvent> = {},
): ContentEvent => ({
  id,
  projectId: null,
  title: id,
  type: "RECORDING",
  status: "PLANNED",
  startAt: start.toISOString(),
  endAt: end.toISOString(),
  notes: null,
  ...extra,
});

const NOW = at(17, 10, 30);

beforeEach(() => vi.clearAllMocks());

describe("today's range", () => {
  it("is the user's local day, midnight to midnight", () => {
    const { from, to } = dayRange(NOW);
    expect(from).toEqual(at(17, 0));
    expect(to).toEqual(at(18, 0));
    expect(dayKey(NOW)).toBe("2026-11-17");
  });

  it("opens the planner on a moment's week", () => {
    expect(plannerUrlFor("2026-11-17T09:00:00.000Z")).toBe(
      "/tools/content-planner?date=2026-11-17T09%3A00%3A00.000Z",
    );
  });
});

describe("selectTodayPlans", () => {
  it("lists today's sessions, closest to now first, and leaves cancelled ones out", () => {
    const plans = selectTodayPlans(
      [
        session("edit", at(17, 15), at(17, 16)),
        session("cancelled", at(17, 9), at(17, 10), { status: "CANCELLED" }),
        session("script", at(17, 8), at(17, 9), { status: "DONE" }),
        session("tomorrow", at(18, 9), at(18, 10)),
        session("record", at(17, 10), at(17, 12)),
      ],
      NOW,
    );

    // 10:30: "record" is happening, "script" ended 1 h 30 min ago, "edit"
    // starts in 4 h 30 min.
    expect(plans.map((p) => p.event.id)).toEqual(["record", "script", "edit"]);
  });

  it("orders by distance to now: now, then the nearest upcoming or past", () => {
    const plans = selectTodayPlans(
      [
        session("morning", at(17, 7), at(17, 7, 30)), // ended 3 h ago
        session("late", at(17, 20), at(17, 21)), // in 9 h 30 min
        session("next", at(17, 10, 45), at(17, 11)), // in 15 min
        session("missed", at(17, 9), at(17, 10)), // ended 30 min ago
        session("live", at(17, 10), at(17, 11)), // now
        session("afternoon", at(17, 13), at(17, 14)), // in 2 h 30 min
      ],
      NOW, // 10:30
    );
    expect(plans.map((p) => p.event.id)).toEqual([
      "live",
      "next",
      "missed",
      "afternoon",
      "morning",
      "late",
    ]);
  });

  it("breaks ties: now, then upcoming (still actionable), then past, then by start", () => {
    const plans = selectTodayPlans(
      [
        session("past-30", at(17, 9), at(17, 10)), // ended 30 min ago
        session("next-30", at(17, 11), at(17, 12)), // in 30 min
        session("live-b", at(17, 10, 15), at(17, 11)),
        session("live-a", at(17, 10), at(17, 12)),
      ],
      NOW,
    );
    expect(plans.map((p) => p.event.id)).toEqual([
      "live-a",
      "live-b",
      "next-30",
      "past-30",
    ]);
  });

  it("keeps the closest sessions when the widget cuts the list", () => {
    const plans = selectTodayPlans(
      Array.from({ length: 8 }, (_, i) =>
        session(`s${i}`, at(17, 6 + 2 * i), at(17, 7 + 2 * i)),
      ),
      NOW,
    );
    // Sessions at 06, 08, 10, 12, 14, 16, 18, 20 (1 h each), at 10:30.
    expect(plans.slice(0, 5).map((p) => p.event.id)).toEqual([
      "s2", // 10:00–11:00: now
      "s3", // 12:00: in 1 h 30 — ties with s1, upcoming first
      "s1", // ended 09:00: 1 h 30 ago
      "s4", // 14:00: in 3 h 30 — ties with s0, upcoming first
      "s0", // ended 07:00: 3 h 30 ago
    ]);
    // The furthest (16, 18, 20) are the ones left for "+N more".
    expect(plans.slice(5).map((p) => p.event.id)).toEqual(["s5", "s6", "s7"]);
  });

  it("marks the session happening now (not a done one)", () => {
    const plans = selectTodayPlans(
      [
        session("record", at(17, 10), at(17, 12)),
        session("done-now", at(17, 10), at(17, 11), { status: "DONE" }),
        session("later", at(17, 15), at(17, 16)),
      ],
      NOW,
    );
    expect(plans.map((p) => [p.event.id, p.isNow])).toEqual([
      ["record", true],
      ["done-now", false],
      ["later", false],
    ]);
  });

  it("keeps sessions that cross midnight and says so", () => {
    const [overnight, late] = selectTodayPlans(
      [
        session("overnight", at(16, 22), at(17, 2)),
        session("late", at(17, 23), at(18, 1)),
      ],
      NOW,
    );
    expect(overnight).toMatchObject({ startedBefore: true, endsAfter: false });
    expect(late).toMatchObject({ startedBefore: false, endsAfter: true });
  });
});

describe("countdown", () => {
  it("counts down to upcoming sessions, rounding up", () => {
    const plans = selectTodayPlans(
      [
        session("soon", at(17, 11), at(17, 12)),
        session("later", at(17, 16, 0), at(17, 17)),
        session("seconds", new Date(NOW.getTime() + 20_000), at(17, 12)),
      ],
      NOW, // 10:30
    );
    const byId = Object.fromEntries(plans.map((p) => [p.event.id, p]));
    expect(byId.soon).toMatchObject({ phase: "upcoming", minutes: 30 });
    expect(byId.later).toMatchObject({ phase: "upcoming", minutes: 330 });
    // Never "in 0 min".
    expect(byId.seconds).toMatchObject({ phase: "upcoming", minutes: 1 });
  });

  it("sessions happening now have no countdown", () => {
    const [plan] = selectTodayPlans(
      [session("rec", at(17, 10), at(17, 12))],
      NOW,
    );
    expect(plan).toMatchObject({ phase: "now", minutes: 0, isNow: true });
  });

  it("past sessions count the time since they ended and are overdue unless done", () => {
    const plans = selectTodayPlans(
      [
        session("missed", at(17, 8), at(17, 9)),
        session("done", at(17, 9), at(17, 10), { status: "DONE" }),
        session("just", at(17, 9, 30), new Date(NOW.getTime() - 20_000)),
      ],
      NOW,
    );
    const byId = (id: string) => plans.find((p) => p.event.id === id)!;
    const [missed, done, justNow] = [
      byId("missed"),
      byId("done"),
      byId("just"),
    ];
    expect(missed).toMatchObject({ phase: "past", minutes: 90, overdue: true });
    expect(done).toMatchObject({ phase: "past", minutes: 30, overdue: false });
    expect(justNow).toMatchObject({ phase: "past", minutes: 0, overdue: true });
  });

  it("splits minutes into hours and minutes", () => {
    expect(splitMinutes(30)).toEqual({ hours: 0, minutes: 30 });
    expect(splitMinutes(60)).toEqual({ hours: 1, minutes: 0 });
    expect(splitMinutes(330)).toEqual({ hours: 5, minutes: 30 });
    expect(splitMinutes(-5)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe("fetchPlans", () => {
  it("asks the planner for the day's sessions", async () => {
    const events = [session("record", at(17, 10), at(17, 12))];
    apiMock.get.mockResolvedValue({ data: events });

    expect(await fetchPlans(dayRange(NOW))).toEqual(events);
    expect(apiMock.get).toHaveBeenCalledWith("/tools/content-planner/events", {
      params: {
        from: at(17, 0).toISOString(),
        to: at(18, 0).toISOString(),
      },
    });
  });

  it("treats an unexpected body as no sessions", async () => {
    apiMock.get.mockResolvedValue({});
    expect(await fetchPlans(dayRange(NOW))).toEqual([]);
    apiMock.get.mockResolvedValue(null);
    expect(await fetchPlans(dayRange(NOW))).toEqual([]);
  });
});
