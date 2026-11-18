import { describe, expect, it, vi } from "vitest";
import { AssistantActionRegistry } from "@creator-hub/tool-sdk";
import {
  CREATE_EVENT_ACTION,
  ContentPlannerAssistantActions,
  LIST_EVENTS_ACTION,
} from "../assistant-actions";

const NOW = new Date("2026-11-27T15:00:00Z"); // Fri 10:00 in Bogotá
const CONTEXT = {
  userId: "u1",
  timeZone: "America/Bogota",
  now: NOW,
  language: "es",
};

function setup() {
  const planner = {
    createEvent: vi.fn(
      async (_userId: string, dto: Record<string, unknown>) => ({
        event: {
          id: "ev1",
          title: dto.title,
          type: dto.type,
          status: "PLANNED",
          startAt: new Date(dto.startAt as string),
          endAt: new Date(dto.endAt as string),
          reminderMinutes:
            dto.reminderMinutes === undefined ? 15 : dto.reminderMinutes,
        },
        conflicts: [] as Array<Record<string, unknown>>,
      }),
    ),
    listEvents: vi.fn(async () => [] as Array<Record<string, unknown>>),
  };
  const actions = new ContentPlannerAssistantActions(planner as never);
  const [create, list] = actions.actions();
  return { planner, actions, create: create!, list: list! };
}

describe("Content Planner assistant actions", () => {
  it("registers create and list in the assistant action registry", () => {
    const registry = new AssistantActionRegistry();
    vi.spyOn(console, "log").mockImplementation(() => {});
    new ContentPlannerAssistantActions({} as never, registry).onModuleInit();
    expect(registry.list().map((a) => [a.name, a.mutates])).toEqual([
      [CREATE_EVENT_ACTION, true],
      [LIST_EVENTS_ACTION, false],
    ]);
    const create = registry.list()[0]!;
    expect(
      create.parameters.filter((p) => p.required).map((p) => p.name),
    ).toEqual(["title", "date", "startTime"]);
    // Worked examples for the model, valid against their own parameters.
    for (const action of registry.list()) {
      expect(action.example).toBeDefined();
      for (const key of Object.keys(action.example!.args)) {
        expect(action.parameters.map((p) => p.name)).toContain(key);
      }
    }
  });

  it("does nothing without a registry (calendar-only setups)", () => {
    expect(() =>
      new ContentPlannerAssistantActions({} as never).onModuleInit(),
    ).not.toThrow();
  });

  it("creates a session at the user's local time", async () => {
    const { planner, create } = setup();

    const result = await create.execute(
      {
        title: "Grabar el video de unboxing",
        date: "2026-11-28",
        startTime: "15:00",
        endTime: "16:30",
        type: "RECORDING",
      },
      CONTEXT,
    );

    expect(planner.createEvent).toHaveBeenCalledWith("u1", {
      title: "Grabar el video de unboxing",
      type: "RECORDING",
      startAt: "2026-11-28T20:00:00.000Z",
      endAt: "2026-11-28T21:30:00.000Z",
      notes: undefined,
      reminderMinutes: undefined,
    });
    expect(result.ok).toBe(true);
    expect(result.summary).toBe(
      'Created "Grabar el video de unboxing" (RECORDING) on Saturday 2026-11-28 15:00–16:30 (America/Bogota), reminder 15 min before.',
    );
    expect(result.data).toEqual({
      kind: "calendar-event",
      event: {
        id: "ev1",
        title: "Grabar el video de unboxing",
        type: "RECORDING",
        status: "PLANNED",
        startAt: "2026-11-28T20:00:00.000Z",
        endAt: "2026-11-28T21:30:00.000Z",
      },
      conflicts: [],
      url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
    });
  });

  it("uses a duration (also past midnight), OTHER type and the chosen reminder", async () => {
    const { planner, create } = setup();
    await create.execute(
      {
        title: "Live",
        date: "2026-11-28",
        startTime: "23:00",
        durationMinutes: 120,
        reminderMinutes: 60,
        notes: "Q&A",
      },
      CONTEXT,
    );
    expect(planner.createEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        type: "OTHER",
        startAt: "2026-11-29T04:00:00.000Z",
        endAt: "2026-11-29T06:00:00.000Z",
        reminderMinutes: 60,
        notes: "Q&A",
      }),
    );
  });

  it("asks for what's missing or wrong instead of guessing", async () => {
    const { planner, create } = setup();
    const base = { title: "Edit", date: "2026-11-28", startTime: "10:00" };

    const noEnd = await create.execute(base, CONTEXT);
    expect(noEnd).toEqual({
      ok: false,
      summary:
        "Missing the end time or the duration. Ask the user when it ends.",
    });

    const backwards = await create.execute(
      { ...base, endTime: "09:00" },
      CONTEXT,
    );
    expect(backwards.ok).toBe(false);
    expect(backwards.summary).toMatch(/not after the start time/);

    const past = await create.execute(
      { ...base, date: "2026-11-27", startTime: "08:00", endTime: "09:00" },
      CONTEXT,
    );
    expect(past.ok).toBe(false);
    expect(past.summary).toMatch(
      /in the past — it is now Friday 2026-11-27 10:00/,
    );

    expect(planner.createEvent).not.toHaveBeenCalled();
  });

  it("rejects a time skipped by daylight saving", async () => {
    const { create } = setup();
    const result = await create.execute(
      { title: "X", date: "2027-03-14", startTime: "02:30", endTime: "03:30" },
      { ...CONTEXT, timeZone: "America/New_York" },
    );
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/doesn't exist in America\/New_York/);
  });

  it("reports overlapping sessions as a warning", async () => {
    const { planner, create } = setup();
    planner.createEvent.mockImplementationOnce(async (_u, dto) => ({
      event: {
        id: "ev2",
        title: dto.title,
        type: "OTHER",
        status: "PLANNED",
        startAt: new Date(dto.startAt as string),
        endAt: new Date(dto.endAt as string),
        reminderMinutes: null,
      },
      conflicts: [
        {
          id: "ev9",
          title: "Weekly livestream",
          type: "LIVESTREAM",
          startAt: new Date("2026-11-28T20:30:00Z"),
          endAt: new Date("2026-11-28T22:00:00Z"),
        },
      ],
    }));

    const result = await create.execute(
      {
        title: "Call",
        date: "2026-11-28",
        startTime: "15:00",
        endTime: "16:00",
      },
      CONTEXT,
    );

    expect(result.summary).toContain("no reminder");
    expect(result.summary).toContain(
      'Warning — it overlaps with: "Weekly livestream" Saturday 2026-11-28 15:30–17:00.',
    );
    expect(result.data).toMatchObject({
      conflicts: [{ id: "ev9", title: "Weekly livestream" }],
    });
  });

  it("reads the agenda of local days", async () => {
    const { planner, list } = setup();
    planner.listEvents.mockResolvedValue([
      {
        id: "a",
        title: "Script",
        type: "SCRIPTING",
        status: "PLANNED",
        startAt: new Date("2026-11-28T14:00:00Z"),
        endAt: new Date("2026-11-28T15:30:00Z"),
      },
      {
        id: "b",
        title: "Old",
        type: "OTHER",
        status: "CANCELLED",
        startAt: new Date("2026-11-28T16:00:00Z"),
        endAt: new Date("2026-11-28T17:00:00Z"),
      },
    ]);

    const result = await list.execute({ date: "2026-11-28", days: 2 }, CONTEXT);

    expect(planner.listEvents).toHaveBeenCalledWith("u1", {
      from: "2026-11-28T05:00:00.000Z",
      to: "2026-11-30T05:00:00.000Z",
    });
    expect(result.summary).toBe(
      '1 session(s) for 2026-11-28 + 1 days (America/Bogota):\n- Saturday 2026-11-28 09:00–10:30 "Script" (SCRIPTING, PLANNED)',
    );
    expect(result.data).toMatchObject({
      kind: "calendar-agenda",
      from: "2026-11-28",
      days: 2,
      events: [{ id: "a" }],
    });
  });

  it("says so when the day is free", async () => {
    const { list } = setup();
    const result = await list.execute({ date: "2026-11-28" }, CONTEXT);
    expect(result.summary).toBe(
      "No sessions planned for 2026-11-28 (America/Bogota).",
    );
  });
});
