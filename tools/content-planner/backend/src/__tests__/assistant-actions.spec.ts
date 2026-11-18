import { describe, expect, it, vi } from "vitest";
import { AssistantActionRegistry } from "@creator-hub/tool-sdk";
import type { AssistantActionHandler } from "@creator-hub/tool-sdk";
import {
  CREATE_EVENT_ACTION,
  CREATE_PROJECT_ACTION,
  ContentPlannerAssistantActions,
  DELETE_EVENT_ACTION,
  DELETE_PROJECT_ACTION,
  LIST_EVENTS_ACTION,
  LIST_PROJECTS_ACTION,
  UPDATE_EVENT_ACTION,
  UPDATE_PROJECT_ACTION,
} from "../assistant-actions";

const NOW = new Date("2026-11-27T15:00:00Z"); // Fri 10:00 in Bogotá
const CONTEXT = {
  userId: "u1",
  timeZone: "America/Bogota",
  now: NOW,
  language: "es",
};

/** A session as the planner service returns it. */
function session(overrides: Record<string, unknown> = {}) {
  return {
    id: "ev1",
    title: "Grabar el unboxing",
    type: "RECORDING",
    status: "PLANNED",
    startAt: new Date("2026-11-28T20:00:00Z"), // Sat 15:00 Bogotá
    endAt: new Date("2026-11-28T21:00:00Z"),
    notes: null,
    reminderMinutes: 15,
    project: null,
    ...overrides,
  };
}

function setup() {
  const planner = {
    createEvent: vi.fn(
      async (_userId: string, dto: Record<string, unknown>) => ({
        event: session({
          title: dto.title,
          type: dto.type,
          startAt: new Date(dto.startAt as string),
          endAt: new Date(dto.endAt as string),
          reminderMinutes:
            dto.reminderMinutes === undefined ? 15 : dto.reminderMinutes,
        }),
        conflicts: [] as Array<Record<string, unknown>>,
      }),
    ),
    listEvents: vi.fn(async () => [] as Array<Record<string, unknown>>),
    getEvent: vi.fn(async () => session() as Record<string, unknown> | null),
    updateEvent: vi.fn(
      async (_u: string, _id: string, dto: Record<string, unknown>) => ({
        event: session({
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.startAt
            ? {
                startAt: new Date(dto.startAt as string),
                endAt: new Date(dto.endAt as string),
              }
            : {}),
        }),
        conflicts: [] as Array<Record<string, unknown>>,
      }),
    ),
    deleteEvent: vi.fn(async () => undefined),
    listProjects: vi.fn(async () => [] as Array<Record<string, unknown>>),
    getProject: vi.fn(
      async () =>
        ({
          id: "p1",
          title: "Unboxing",
          platform: "youtube-long",
          publishAt: new Date("2026-12-05T23:00:00Z"),
          customPlatform: null,
          _count: { events: 3 },
        }) as Record<string, unknown> | null,
    ),
    createProject: vi.fn(async (_u: string, dto: Record<string, unknown>) => ({
      project: {
        id: "p2",
        title: dto.title,
        platform: dto.platform ?? null,
        publishAt: dto.publishAt ? new Date(dto.publishAt as string) : null,
        customPlatform: null,
        events: [],
      },
      conflicts: [],
    })),
    updateProject: vi.fn(
      async (_u: string, _id: string, dto: Record<string, unknown>) => ({
        id: "p1",
        title: dto.title ?? "Unboxing",
        platform: dto.platform ?? "youtube-long",
        publishAt:
          dto.publishAt === null
            ? null
            : new Date((dto.publishAt as string) ?? "2026-12-05T23:00:00Z"),
        customPlatform: null,
      }),
    ),
    deleteProject: vi.fn(async () => undefined),
  };
  const handlers = new ContentPlannerAssistantActions(
    planner as never,
  ).actions();
  const action = (name: string) =>
    handlers.find((h) => h.name === name) as AssistantActionHandler;
  return { planner, action };
}

describe("Content Planner assistant actions — registration", () => {
  it("registers full control of sessions and video projects", () => {
    const registry = new AssistantActionRegistry();
    vi.spyOn(console, "log").mockImplementation(() => {});
    new ContentPlannerAssistantActions({} as never, registry).onModuleInit();
    expect(
      registry
        .list()
        .map((a) => [a.name, a.mutates, a.requiresConfirmation ?? false]),
    ).toEqual([
      [LIST_EVENTS_ACTION, false, false],
      [CREATE_EVENT_ACTION, true, false],
      [UPDATE_EVENT_ACTION, true, false],
      [DELETE_EVENT_ACTION, true, true],
      [LIST_PROJECTS_ACTION, false, false],
      [CREATE_PROJECT_ACTION, true, false],
      [UPDATE_PROJECT_ACTION, true, false],
      [DELETE_PROJECT_ACTION, true, true],
    ]);
    expect(
      registry
        .get(CREATE_EVENT_ACTION)!
        .parameters.filter((p) => p.required)
        .map((p) => p.name),
    ).toEqual(["title", "date", "startTime"]);
    // Worked examples for the model, valid against their own parameters.
    for (const action of registry.list().filter((a) => a.example)) {
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
});

describe("calendar.create_event", () => {
  it("creates a session at the user's local time", async () => {
    const { planner, action } = setup();

    const result = await action(CREATE_EVENT_ACTION).execute(
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
    expect(result.summary).toBe(
      'Created "Grabar el video de unboxing" (RECORDING, PLANNED) Saturday 2026-11-28 15:00–16:30 (America/Bogota), reminder 15 min before.',
    );
    expect(result.data).toMatchObject({
      kind: "calendar-event",
      change: "created",
      event: { id: "ev1", startAt: "2026-11-28T20:00:00.000Z" },
      conflicts: [],
      url: "/tools/content-planner?date=2026-11-28T20%3A00%3A00.000Z",
    });
  });

  it("uses a duration past midnight, no reminder, and a project", async () => {
    const { planner, action } = setup();
    await action(CREATE_EVENT_ACTION).execute(
      {
        title: "Live",
        date: "2026-11-28",
        startTime: "23:00",
        durationMinutes: 120,
        reminderMinutes: -1,
        projectId: "p1",
      },
      CONTEXT,
    );
    expect(planner.createEvent).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({
        type: "OTHER",
        startAt: "2026-11-29T04:00:00.000Z",
        endAt: "2026-11-29T06:00:00.000Z",
        reminderMinutes: null,
        projectId: "p1",
      }),
    );
  });

  it("asks for what's missing or wrong instead of guessing", async () => {
    const { planner, action } = setup();
    const create = action(CREATE_EVENT_ACTION);
    const base = { title: "Edit", date: "2026-11-28", startTime: "10:00" };

    expect(await create.execute(base, CONTEXT)).toEqual({
      ok: false,
      summary:
        "Missing the end time or the duration. Ask the user when it ends.",
    });
    expect(
      (await create.execute({ ...base, endTime: "09:00" }, CONTEXT)).summary,
    ).toMatch(/not after the start time/);
    expect(
      (
        await create.execute(
          { ...base, date: "2026-11-27", startTime: "08:00", endTime: "09:00" },
          CONTEXT,
        )
      ).summary,
    ).toMatch(/in the past — it is now Friday 2026-11-27 10:00/);
    const dst = await create.execute(
      { title: "X", date: "2027-03-14", startTime: "02:30", endTime: "03:30" },
      { ...CONTEXT, timeZone: "America/New_York" },
    );
    expect(dst.summary).toMatch(/doesn't exist in America\/New_York/);
    expect(planner.createEvent).not.toHaveBeenCalled();
  });

  it("reports overlapping sessions as a warning", async () => {
    const { planner, action } = setup();
    planner.createEvent.mockImplementationOnce(async (_u, dto) => ({
      event: session({
        title: dto.title,
        startAt: new Date(dto.startAt as string),
        endAt: new Date(dto.endAt as string),
        reminderMinutes: null,
      }),
      conflicts: [
        session({
          id: "ev9",
          title: "Weekly livestream",
          type: "LIVESTREAM",
          startAt: new Date("2026-11-28T20:30:00Z"),
          endAt: new Date("2026-11-28T22:00:00Z"),
        }),
      ],
    }));
    const result = await action(CREATE_EVENT_ACTION).execute(
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
  });
});

describe("calendar.list_events", () => {
  it("lists local days with ids, without cancelled sessions", async () => {
    const { planner, action } = setup();
    planner.listEvents.mockResolvedValue([
      session({
        id: "a",
        title: "Script",
        type: "SCRIPTING",
        startAt: new Date("2026-11-28T14:00:00Z"),
        endAt: new Date("2026-11-28T15:30:00Z"),
        project: { id: "p1", title: "Unboxing" },
      }),
      session({ id: "b", title: "Old", status: "CANCELLED" }),
    ]);

    const result = await action(LIST_EVENTS_ACTION).execute(
      { date: "2026-11-28", days: 2 },
      CONTEXT,
    );

    expect(planner.listEvents).toHaveBeenCalledWith("u1", {
      from: "2026-11-28T05:00:00.000Z",
      to: "2026-11-30T05:00:00.000Z",
    });
    expect(result.summary).toBe(
      '1 session(s) for 2026-11-28 + 1 days (America/Bogota):\n- [id a] "Script" (SCRIPTING, PLANNED) Saturday 2026-11-28 09:00–10:30 · project "Unboxing"',
    );
    expect(result.data).toMatchObject({
      kind: "calendar-agenda",
      events: [{ id: "a" }],
    });
  });

  it("finds sessions by name, ignoring case and accents", async () => {
    const { planner, action } = setup();
    planner.listEvents.mockResolvedValue([
      session({ id: "a", title: "Grabación del intro" }),
      session({ id: "b", title: "Editar" }),
    ]);
    const result = await action(LIST_EVENTS_ACTION).execute(
      { date: "2026-11-27", days: 31, query: "GRABACION" },
      CONTEXT,
    );
    expect(result.summary).toMatch(/^1 session\(s\) matching "GRABACION"/);
    expect(result.summary).toContain("[id a]");
    expect(result.summary).not.toContain("[id b]");
  });

  it("says so when nothing is planned", async () => {
    const { action } = setup();
    expect(
      (
        await action(LIST_EVENTS_ACTION).execute(
          { date: "2026-11-28" },
          CONTEXT,
        )
      ).summary,
    ).toBe("No sessions for 2026-11-28 (America/Bogota).");
  });
});

describe("calendar.update_event", () => {
  it("moves a session keeping its length", async () => {
    const { planner, action } = setup();

    const result = await action(UPDATE_EVENT_ACTION).execute(
      { eventId: "ev1", startTime: "17:00" },
      CONTEXT,
    );

    expect(planner.getEvent).toHaveBeenCalledWith("u1", "ev1");
    expect(planner.updateEvent).toHaveBeenCalledWith("u1", "ev1", {
      startAt: "2026-11-28T22:00:00.000Z",
      endAt: "2026-11-28T23:00:00.000Z",
    });
    expect(result.summary).toBe(
      'Updated "Grabar el unboxing" (RECORDING, PLANNED) Saturday 2026-11-28 17:00–18:00 (America/Bogota) — it was Saturday 2026-11-28 15:00–16:00. Changed: startTime.',
    );
    expect(result.data).toMatchObject({
      kind: "calendar-event",
      change: "updated",
      previous: {
        startAt: "2026-11-28T20:00:00.000Z",
        endAt: "2026-11-28T21:00:00.000Z",
      },
    });
  });

  it("moves to another day, or changes only the end", async () => {
    const { planner, action } = setup();
    const update = action(UPDATE_EVENT_ACTION);
    await update.execute({ eventId: "ev1", date: "2026-11-30" }, CONTEXT);
    expect(planner.updateEvent).toHaveBeenLastCalledWith("u1", "ev1", {
      startAt: "2026-11-30T20:00:00.000Z",
      endAt: "2026-11-30T21:00:00.000Z",
    });
    await update.execute({ eventId: "ev1", endTime: "17:30" }, CONTEXT);
    expect(planner.updateEvent).toHaveBeenLastCalledWith("u1", "ev1", {
      startAt: "2026-11-28T20:00:00.000Z",
      endAt: "2026-11-28T22:30:00.000Z",
    });
  });

  it("renames, changes type/status/notes/reminder and project", async () => {
    const { planner, action } = setup();
    await action(UPDATE_EVENT_ACTION).execute(
      {
        eventId: "ev1",
        title: "Grabar intro",
        type: "EDITING",
        status: "DONE",
        notes: "Con luz natural",
        reminderMinutes: -1,
        projectId: "none",
      },
      CONTEXT,
    );
    expect(planner.updateEvent).toHaveBeenCalledWith("u1", "ev1", {
      title: "Grabar intro",
      type: "EDITING",
      customTypeId: null,
      status: "DONE",
      notes: "Con luz natural",
      reminderMinutes: null,
      projectId: null,
    });
  });

  it("refuses unknown ids, empty changes and moves into the past", async () => {
    const { planner, action } = setup();
    const update = action(UPDATE_EVENT_ACTION);
    planner.getEvent.mockResolvedValueOnce(null);
    expect(
      (await update.execute({ eventId: "nope", title: "X" }, CONTEXT)).summary,
    ).toMatch(/^No session with id nope/);
    expect((await update.execute({ eventId: "ev1" }, CONTEXT)).summary).toMatch(
      /^Nothing to change/,
    );
    expect(
      (await update.execute({ eventId: "ev1", date: "2026-11-26" }, CONTEXT))
        .summary,
    ).toMatch(/in the past/);
    expect(planner.updateEvent).not.toHaveBeenCalled();
  });

  it("marks a past session done without a time check", async () => {
    const { planner, action } = setup();
    planner.getEvent.mockResolvedValueOnce(
      session({ startAt: new Date("2026-11-20T20:00:00Z") }),
    );
    const result = await action(UPDATE_EVENT_ACTION).execute(
      { eventId: "ev1", status: "DONE" },
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    expect(planner.updateEvent).toHaveBeenCalledWith("u1", "ev1", {
      status: "DONE",
    });
  });
});

describe("calendar.delete_event", () => {
  it("needs confirmation, previews what would go, then deletes", async () => {
    const { planner, action } = setup();
    const remove = action(DELETE_EVENT_ACTION);
    expect(remove.requiresConfirmation).toBe(true);

    const preview = await remove.describe!({ eventId: "ev1" }, CONTEXT);
    expect(preview.summary).toBe(
      'Would delete "Grabar el unboxing" (RECORDING, PLANNED) Saturday 2026-11-28 15:00–16:00 for good.',
    );
    expect(preview.data).toMatchObject({ change: "deleted" });
    expect(planner.deleteEvent).not.toHaveBeenCalled();

    const result = await remove.execute({ eventId: "ev1" }, CONTEXT);
    expect(planner.deleteEvent).toHaveBeenCalledWith("u1", "ev1");
    expect(result.summary).toBe(
      'Deleted "Grabar el unboxing" (RECORDING, PLANNED) Saturday 2026-11-28 15:00–16:00.',
    );
  });

  it("fails on unknown ids", async () => {
    const { planner, action } = setup();
    planner.getEvent.mockResolvedValue(null);
    const result = await action(DELETE_EVENT_ACTION).execute(
      { eventId: "nope" },
      CONTEXT,
    );
    expect(result.ok).toBe(false);
    expect(planner.deleteEvent).not.toHaveBeenCalled();
  });
});

describe("video projects", () => {
  it("lists projects with ids, publish date and progress", async () => {
    const { planner, action } = setup();
    planner.listProjects.mockResolvedValue([
      {
        id: "p1",
        title: "Unboxing",
        platform: "youtube-long",
        notes: null,
        customPlatform: null,
        publishAt: new Date("2026-12-05T23:00:00Z"),
        progress: { total: 5, done: 2 },
        nextEvent: session(),
      },
      {
        id: "p2",
        title: "Vlog",
        platform: null,
        notes: null,
        customPlatform: { name: "Kick" },
        publishAt: null,
        progress: { total: 0, done: 0 },
        nextEvent: null,
      },
    ]);

    const result = await action(LIST_PROJECTS_ACTION).execute({}, CONTEXT);

    expect(result.summary).toBe(
      '2 video project(s) (America/Bogota):\n- [id p1] "Unboxing" · youtube-long · publish Saturday 2026-12-05 18:00 · 2/5 sessions done · next: "Grabar el unboxing" Saturday 2026-11-28 15:00–16:00\n- [id p2] "Vlog" · Kick · no publish date · 0/0 sessions done',
    );
    expect(result.data).toMatchObject({
      kind: "calendar-projects",
      projects: [
        { id: "p1", sessions: { total: 5, done: 2 } },
        { id: "p2", platform: "Kick" },
      ],
    });
    const filtered = await action(LIST_PROJECTS_ACTION).execute(
      { query: "vlog" },
      CONTEXT,
    );
    expect(filtered.summary).toMatch(/^1 video project\(s\) matching "vlog"/);
  });

  it("creates a project with its publish moment", async () => {
    const { planner, action } = setup();
    const result = await action(CREATE_PROJECT_ACTION).execute(
      {
        title: "Review del teléfono",
        publishDate: "2026-12-10",
        publishTime: "18:00",
        platform: "youtube-long",
      },
      CONTEXT,
    );
    expect(planner.createProject).toHaveBeenCalledWith("u1", {
      title: "Review del teléfono",
      platform: "youtube-long",
      publishAt: "2026-12-10T23:00:00.000Z",
    });
    expect(result.summary).toContain(
      'Created the video project "Review del teléfono", publishing Thursday 2026-12-10 18:00',
    );
    expect(result.summary).toContain("[id p2]");
  });

  it("asks for the publish time instead of assuming one", async () => {
    const { planner, action } = setup();
    const result = await action(CREATE_PROJECT_ACTION).execute(
      { title: "X", publishDate: "2026-12-10" },
      CONTEXT,
    );
    expect(result).toEqual({
      ok: false,
      summary: "Missing the publish time. Ask the user.",
    });
    expect(planner.createProject).not.toHaveBeenCalled();
  });

  it("updates a project: new date keeps the time; the date can be removed", async () => {
    const { planner, action } = setup();
    const update = action(UPDATE_PROJECT_ACTION);
    await update.execute(
      { projectId: "p1", publishDate: "2026-12-12", title: "Unboxing 2" },
      CONTEXT,
    );
    expect(planner.updateProject).toHaveBeenLastCalledWith("u1", "p1", {
      title: "Unboxing 2",
      publishAt: "2026-12-12T23:00:00.000Z",
    });
    await update.execute({ projectId: "p1", removePublishDate: true }, CONTEXT);
    expect(planner.updateProject).toHaveBeenLastCalledWith("u1", "p1", {
      publishAt: null,
    });
  });

  it("deleting a project needs confirmation and says how many sessions go with it", async () => {
    const { planner, action } = setup();
    const remove = action(DELETE_PROJECT_ACTION);
    expect(remove.requiresConfirmation).toBe(true);
    expect((await remove.describe!({ projectId: "p1" }, CONTEXT)).summary).toBe(
      'Would delete the video project "Unboxing" (publishing Saturday 2026-12-05 18:00) and its 3 session(s) for good.',
    );
    const result = await remove.execute({ projectId: "p1" }, CONTEXT);
    expect(planner.deleteProject).toHaveBeenCalledWith("u1", "p1");
    expect(result.summary).toMatch(/^Deleted the video project "Unboxing"/);
  });
});
