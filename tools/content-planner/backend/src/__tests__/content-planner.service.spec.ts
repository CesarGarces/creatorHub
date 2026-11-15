import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

const prismaMock = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    count: vi.fn(),
  });
  return {
    contentEvent: model(),
    contentProject: model(),
    contentCustomType: model(),
    contentCustomPlatform: model(),
    contentProductionStep: model(),
    // Array form: the queries were already built; just await them.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
});

vi.mock("@creator-hub/database", () => ({ prisma: prismaMock }));

import { ContentPlannerService } from "../content-planner.service";

const USER = "user-1";
const d = (iso: string) => new Date(iso);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  // Default: no other sessions around, so no conflicts.
  prismaMock.contentEvent.findMany.mockResolvedValue([]);
});

const service = new ContentPlannerService();

describe("listEvents", () => {
  it("queries every session that intersects the window, scoped to the user", async () => {
    await service.listEvents(USER, {
      from: "2026-03-02T00:00:00.000Z",
      to: "2026-03-09T00:00:00.000Z",
    });

    expect(prismaMock.contentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER,
          startAt: { lt: d("2026-03-09T00:00:00.000Z") },
          endAt: { gt: d("2026-03-02T00:00:00.000Z") },
        },
        orderBy: { startAt: "asc" },
      }),
    );
  });

  it("rejects inverted and oversized windows", async () => {
    await expect(
      service.listEvents(USER, {
        from: "2026-03-09T00:00:00.000Z",
        to: "2026-03-02T00:00:00.000Z",
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.listEvents(USER, {
        from: "2026-01-01T00:00:00.000Z",
        to: "2026-12-31T00:00:00.000Z",
      }),
    ).rejects.toThrow("too large");
    expect(prismaMock.contentEvent.findMany).not.toHaveBeenCalled();
  });
});

describe("createEvent", () => {
  const body = {
    title: "  Record intro  ",
    type: "RECORDING" as const,
    startAt: "2026-03-02T10:00:00.000Z",
    endAt: "2026-03-02T12:00:00.000Z",
    notes: "   ",
  };

  it("stores a trimmed session and reports overlapping ones", async () => {
    prismaMock.contentEvent.create.mockResolvedValue({
      id: "e1",
      startAt: d(body.startAt),
      endAt: d(body.endAt),
    });
    const clash = {
      id: "e0",
      title: "Edit",
      type: "EDITING",
      startAt: d("2026-03-02T11:00:00.000Z"),
      endAt: d("2026-03-02T13:00:00.000Z"),
    };
    prismaMock.contentEvent.findMany.mockResolvedValue([clash]);

    const result = await service.createEvent(USER, body);

    expect(prismaMock.contentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: USER,
          projectId: null,
          customTypeId: null,
          title: "Record intro",
          type: "RECORDING",
          status: "PLANNED",
          startAt: d(body.startAt),
          endAt: d(body.endAt),
          notes: null,
        },
      }),
    );
    expect(result.conflicts).toEqual([clash]);
    // Conflict lookup excludes the session itself and cancelled ones.
    expect(prismaMock.contentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: USER,
          id: { notIn: ["e1"] },
          status: { not: "CANCELLED" },
        }),
      }),
    );
  });

  it("rejects sessions that end before they start or last over 24h", async () => {
    await expect(
      service.createEvent(USER, { ...body, endAt: body.startAt }),
    ).rejects.toThrow("end after it starts");
    await expect(
      service.createEvent(USER, { ...body, endAt: "2026-03-03T10:00:01.000Z" }),
    ).rejects.toThrow("24 hours");
    expect(prismaMock.contentEvent.create).not.toHaveBeenCalled();
  });

  it("refuses to attach a session to another user's project", async () => {
    prismaMock.contentProject.findFirst.mockResolvedValue(null);

    await expect(
      service.createEvent(USER, { ...body, projectId: "someone-elses" }),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.contentProject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "someone-elses", userId: USER } }),
    );
    expect(prismaMock.contentEvent.create).not.toHaveBeenCalled();
  });
});

describe("updateEvent", () => {
  const current = {
    id: "e1",
    userId: USER,
    startAt: d("2026-03-02T10:00:00.000Z"),
    endAt: d("2026-03-02T12:00:00.000Z"),
  };

  it("404s for sessions the user doesn't own", async () => {
    prismaMock.contentEvent.findFirst.mockResolvedValue(null);
    await expect(
      service.updateEvent(USER, "e1", { title: "x" }),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.contentEvent.update).not.toHaveBeenCalled();
  });

  it("validates the merged time range when only one end moves", async () => {
    prismaMock.contentEvent.findFirst.mockResolvedValue(current);
    await expect(
      service.updateEvent(USER, "e1", { startAt: "2026-03-02T13:00:00.000Z" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("reschedules, detaches from the project and skips conflicts when cancelled", async () => {
    prismaMock.contentEvent.findFirst.mockResolvedValue(current);
    prismaMock.contentEvent.update.mockImplementation(
      async ({ data }: any) => ({
        ...current,
        ...data,
      }),
    );

    const result = await service.updateEvent(USER, "e1", {
      startAt: "2026-03-03T10:00:00.000Z",
      endAt: "2026-03-03T11:00:00.000Z",
      status: "CANCELLED",
      projectId: null,
    });

    expect(prismaMock.contentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e1" },
        data: {
          status: "CANCELLED",
          projectId: null,
          startAt: d("2026-03-03T10:00:00.000Z"),
          endAt: d("2026-03-03T11:00:00.000Z"),
        },
      }),
    );
    expect(result.conflicts).toEqual([]);
    expect(prismaMock.contentEvent.findMany).not.toHaveBeenCalled();
  });
});

describe("deletion is scoped to the owner", () => {
  it("deletes a session and 404s when nothing matched", async () => {
    prismaMock.contentEvent.deleteMany.mockResolvedValueOnce({ count: 1 });
    await service.deleteEvent(USER, "e1");
    expect(prismaMock.contentEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: "e1", userId: USER },
    });

    prismaMock.contentEvent.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.deleteEvent(USER, "e2")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("deletes a project and 404s when nothing matched", async () => {
    prismaMock.contentProject.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.deleteProject(USER, "p1")).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.contentProject.deleteMany).toHaveBeenCalledWith({
      where: { id: "p1", userId: USER },
    });
  });
});

describe("projects", () => {
  it("summarises progress and the next pending session, ignoring cancelled ones", async () => {
    vi.useFakeTimers({ now: d("2026-03-03T09:00:00.000Z") });
    const ev = (id: string, status: string, day: string) => ({
      id,
      title: id,
      type: "OTHER",
      status,
      startAt: d(`2026-03-0${day}T10:00:00.000Z`),
      endAt: d(`2026-03-0${day}T11:00:00.000Z`),
    });
    prismaMock.contentProject.findMany.mockResolvedValue([
      {
        id: "p1",
        title: "Video",
        events: [
          ev("ideation", "DONE", "1"),
          ev("script", "PLANNED", "2"), // overdue, already ended
          ev("dropped", "CANCELLED", "3"),
          ev("record", "PLANNED", "4"),
          ev("edit", "PLANNED", "5"),
        ],
      },
    ]);

    const [project] = await service.listProjects(USER);
    vi.useRealTimers();

    expect(project).not.toHaveProperty("events");
    expect(project.progress).toEqual({ total: 4, done: 1 });
    expect(project.nextEvent?.id).toBe("record");
  });

  it("creates the project and its sessions in one write, owned by the user", async () => {
    prismaMock.contentProject.create.mockImplementation(
      async ({ data }: any) => ({
        id: "p1",
        ...data,
        events: data.events.create.map((e: any, i: number) => ({
          id: `e${i}`,
          ...e,
        })),
      }),
    );

    const { project } = await service.createProject(USER, {
      title: " Launch video ",
      platform: "youtube-long",
      publishAt: "2026-03-06T18:00:00.000Z",
      events: [
        {
          title: "Script",
          type: "SCRIPTING",
          startAt: "2026-03-02T10:00:00.000Z",
          endAt: "2026-03-02T12:00:00.000Z",
        },
      ],
    });

    const { data } = prismaMock.contentProject.create.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: USER,
      title: "Launch video",
      publishAt: d("2026-03-06T18:00:00.000Z"),
    });
    expect(data.events.create).toEqual([
      expect.objectContaining({
        userId: USER,
        type: "SCRIPTING",
        status: "PLANNED",
      }),
    ]);
    expect(project.id).toBe("p1");
  });

  it("rejects the whole project before writing if one session is invalid", async () => {
    await expect(
      service.createProject(USER, {
        title: "Video",
        events: [
          {
            title: "Broken",
            type: "EDITING",
            startAt: "2026-03-02T12:00:00.000Z",
            endAt: "2026-03-02T10:00:00.000Z",
          },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.contentProject.create).not.toHaveBeenCalled();
  });

  it("checks ownership before updating and clears nullable fields", async () => {
    prismaMock.contentProject.findFirst.mockResolvedValue({ id: "p1" });
    await service.updateProject(USER, "p1", { publishAt: null, notes: "" });

    expect(prismaMock.contentProject.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { publishAt: null, notes: null },
      include: { customPlatform: { select: { id: true, name: true } } },
    });
  });
});

describe("getStats", () => {
  it("totals every registered session, ignoring cancelled ones", async () => {
    prismaMock.contentEvent.findMany.mockResolvedValue([
      {
        status: "DONE",
        startAt: d("2026-01-10T10:00:00Z"),
        endAt: d("2026-01-10T11:30:00Z"),
      },
      {
        status: "PLANNED",
        startAt: d("2026-03-02T10:00:00Z"),
        endAt: d("2026-03-02T12:00:00Z"),
      },
      {
        status: "IN_PROGRESS",
        startAt: d("2027-05-01T22:00:00Z"),
        endAt: d("2027-05-02T01:00:00Z"),
      },
    ]);

    expect(await service.getStats(USER)).toEqual({
      sessions: 3,
      plannedMinutes: 90 + 120 + 180,
      done: 1,
    });
    // No date window: the whole calendar of this user.
    expect(prismaMock.contentEvent.findMany).toHaveBeenCalledWith({
      where: { userId: USER, status: { not: "CANCELLED" } },
      select: { status: true, startAt: true, endAt: true },
    });
  });

  it("returns zeros for an empty calendar", async () => {
    expect(await service.getStats(USER)).toEqual({
      sessions: 0,
      plannedMinutes: 0,
      done: 0,
    });
  });
});

describe("custom types", () => {
  beforeEach(() => {
    prismaMock.contentCustomType.count.mockResolvedValue(0);
    prismaMock.contentCustomType.findFirst.mockResolvedValue(null);
    prismaMock.contentCustomType.create.mockImplementation(
      async ({ data }: any) => ({
        id: "t1",
        name: data.name,
        color: data.color,
      }),
    );
  });

  it("creates a type with a normalised name", async () => {
    const type = await service.createCustomType(USER, {
      name: "  Sponsor   call ",
      color: "teal",
    });

    expect(type).toEqual({ id: "t1", name: "Sponsor call", color: "teal" });
    expect(prismaMock.contentCustomType.create).toHaveBeenCalledWith({
      // Icon defaults to "tag" when none is chosen.
      data: { userId: USER, name: "Sponsor call", color: "teal", icon: "tag" },
      select: { id: true, name: true, color: true, icon: true },
    });
  });

  it("stores the chosen icon", async () => {
    await service.createCustomType(USER, {
      name: "Podcast",
      color: "lime",
      icon: "mic",
    });
    expect(prismaMock.contentCustomType.create.mock.calls[0][0].data.icon).toBe(
      "mic",
    );
  });

  it("rejects names the user already has, ignoring case", async () => {
    prismaMock.contentCustomType.findFirst.mockResolvedValue({ id: "t0" });

    await expect(
      service.createCustomType(USER, { name: "podcast", color: "lime" }),
    ).rejects.toThrow(ConflictException);
    expect(prismaMock.contentCustomType.findFirst).toHaveBeenCalledWith({
      where: { userId: USER, name: { equals: "podcast", mode: "insensitive" } },
      select: { id: true },
    });
    expect(prismaMock.contentCustomType.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race to a 409", async () => {
    prismaMock.contentCustomType.create.mockRejectedValue({ code: "P2002" });
    await expect(
      service.createCustomType(USER, { name: "Podcast", color: "lime" }),
    ).rejects.toThrow(ConflictException);
  });

  it("enforces the per-user limit and rejects blank names", async () => {
    prismaMock.contentCustomType.count.mockResolvedValue(30);
    await expect(
      service.createCustomType(USER, { name: "One more", color: "lime" }),
    ).rejects.toThrow("up to 30 custom types");

    await expect(
      service.createCustomType(USER, { name: "   ", color: "lime" }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.contentCustomType.create).not.toHaveBeenCalled();
  });

  it("deletes only the user's own types", async () => {
    prismaMock.contentCustomType.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteCustomType(USER, "t9")).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.contentCustomType.deleteMany).toHaveBeenCalledWith({
      where: { id: "t9", userId: USER },
    });
  });
});

describe("sessions with a custom type", () => {
  const slot = {
    startAt: "2026-03-02T10:00:00.000Z",
    endAt: "2026-03-02T11:00:00.000Z",
  };

  it("stores a custom-typed session as OTHER after checking ownership", async () => {
    prismaMock.contentCustomType.findFirst.mockResolvedValue({ id: "t1" });
    prismaMock.contentEvent.create.mockImplementation(
      async ({ data }: any) => ({
        id: "e1",
        ...data,
      }),
    );

    await service.createEvent(USER, {
      ...slot,
      title: "Weekly podcast",
      type: "RECORDING",
      customTypeId: "t1",
    });

    expect(prismaMock.contentCustomType.findFirst).toHaveBeenCalledWith({
      where: { id: "t1", userId: USER },
      select: { id: true },
    });
    expect(prismaMock.contentEvent.create.mock.calls[0][0].data).toMatchObject({
      type: "OTHER",
      customTypeId: "t1",
    });
  });

  it("refuses another user's custom type", async () => {
    prismaMock.contentCustomType.findFirst.mockResolvedValue(null);
    await expect(
      service.createEvent(USER, {
        ...slot,
        title: "x",
        type: "OTHER",
        customTypeId: "theirs",
      }),
    ).rejects.toThrow("Type not found");
    expect(prismaMock.contentEvent.create).not.toHaveBeenCalled();
  });

  describe("updating the type", () => {
    const current = {
      id: "e1",
      userId: USER,
      startAt: d(slot.startAt),
      endAt: d(slot.endAt),
    };
    beforeEach(() => {
      prismaMock.contentEvent.findFirst.mockResolvedValue(current);
      prismaMock.contentEvent.update.mockImplementation(
        async ({ data }: any) => ({
          ...current,
          status: "PLANNED",
          ...data,
        }),
      );
    });
    const sentData = () => prismaMock.contentEvent.update.mock.calls[0][0].data;

    it("switching to a built-in type drops the custom one", async () => {
      await service.updateEvent(USER, "e1", { type: "EDITING" });
      expect(sentData()).toMatchObject({ type: "EDITING", customTypeId: null });
    });

    it("switching to a custom type forces OTHER", async () => {
      prismaMock.contentCustomType.findFirst.mockResolvedValue({ id: "t1" });
      await service.updateEvent(USER, "e1", {
        type: "EDITING",
        customTypeId: "t1",
      });
      expect(sentData()).toMatchObject({ type: "OTHER", customTypeId: "t1" });
    });

    it("leaves the type alone when only the time changes", async () => {
      await service.updateEvent(USER, "e1", {
        startAt: "2026-03-02T10:30:00.000Z",
      });
      expect(sentData()).not.toHaveProperty("type");
      expect(sentData()).not.toHaveProperty("customTypeId");
    });
  });
});

describe("custom platforms", () => {
  beforeEach(() => {
    prismaMock.contentCustomPlatform.count.mockResolvedValue(0);
    prismaMock.contentCustomPlatform.findFirst.mockResolvedValue(null);
    prismaMock.contentCustomPlatform.create.mockImplementation(
      async ({ data }: any) => ({
        id: "pl1",
        name: data.name,
      }),
    );
  });

  it("creates a platform with a normalised name", async () => {
    expect(
      await service.createCustomPlatform(USER, { name: "  Kick   live " }),
    ).toEqual({
      id: "pl1",
      name: "Kick live",
    });
  });

  it("rejects duplicates ignoring case, blank names and the 31st platform", async () => {
    prismaMock.contentCustomPlatform.findFirst.mockResolvedValueOnce({
      id: "x",
    });
    await expect(
      service.createCustomPlatform(USER, { name: "kick" }),
    ).rejects.toThrow(ConflictException);
    await expect(
      service.createCustomPlatform(USER, { name: "  " }),
    ).rejects.toThrow("Platform name is required");
    prismaMock.contentCustomPlatform.count.mockResolvedValue(30);
    await expect(
      service.createCustomPlatform(USER, { name: "Rumble" }),
    ).rejects.toThrow("up to 30 custom platforms");
  });

  it("deletes only the user's own platforms", async () => {
    prismaMock.contentCustomPlatform.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteCustomPlatform(USER, "pl9")).rejects.toThrow(
      "Platform not found",
    );
    expect(prismaMock.contentCustomPlatform.deleteMany).toHaveBeenCalledWith({
      where: { id: "pl9", userId: USER },
    });
  });

  it("links a project to the user's platform and clears the built-in one", async () => {
    prismaMock.contentCustomPlatform.findFirst.mockResolvedValue({ id: "pl1" });
    prismaMock.contentProject.create.mockImplementation(
      async ({ data }: any) => ({
        id: "p1",
        ...data,
        events: [],
      }),
    );

    await service.createProject(USER, {
      title: "Stream highlights",
      platform: "youtube-long",
      customPlatformId: "pl1",
    });

    expect(
      prismaMock.contentProject.create.mock.calls[0][0].data,
    ).toMatchObject({
      platform: null,
      customPlatformId: "pl1",
    });
  });

  it("refuses another user's platform", async () => {
    prismaMock.contentCustomPlatform.findFirst.mockResolvedValue(null);
    await expect(
      service.createProject(USER, { title: "x", customPlatformId: "theirs" }),
    ).rejects.toThrow("Platform not found");
    expect(prismaMock.contentProject.create).not.toHaveBeenCalled();
  });

  it("can switch a project to a custom platform and back", async () => {
    prismaMock.contentProject.findFirst.mockResolvedValue({ id: "p1" });
    prismaMock.contentCustomPlatform.findFirst.mockResolvedValue({ id: "pl1" });

    await service.updateProject(USER, "p1", { customPlatformId: "pl1" });
    expect(prismaMock.contentProject.update.mock.calls[0][0].data).toEqual({
      customPlatformId: "pl1",
      platform: null,
    });

    await service.updateProject(USER, "p1", {
      customPlatformId: null,
      platform: "tiktok",
    });
    expect(prismaMock.contentProject.update.mock.calls[1][0].data).toEqual({
      platform: "tiktok",
      customPlatformId: null,
    });
  });
});

describe("plan sessions from customised production steps", () => {
  const session = (
    title: string,
    customType?: { name: string; color: any; icon?: any },
  ) => ({
    title,
    type: "RECORDING" as const,
    startAt: "2026-03-02T10:00:00.000Z",
    endAt: "2026-03-02T11:00:00.000Z",
    ...(customType ? { customType } : {}),
  });

  beforeEach(() => {
    let n = 0;
    prismaMock.contentCustomType.create.mockImplementation(async () => ({
      id: `new${++n}`,
    }));
    prismaMock.contentProject.create.mockImplementation(
      async ({ data }: any) => ({
        id: "p1",
        ...data,
        events: data.events.create.map((e: any, i: number) => ({
          id: `e${i}`,
          ...e,
        })),
      }),
    );
  });
  const createdEvents = () =>
    prismaMock.contentProject.create.mock.calls[0][0].data.events.create;

  it("reuses a same-named custom type (any case), updating its look, and creates missing ones", async () => {
    prismaMock.contentCustomType.findMany.mockResolvedValue([
      { id: "t-voice", name: "Voiceover", color: "teal", icon: "tag" },
    ]);

    await service.createProject(USER, {
      title: "Video",
      events: [
        session("Voiceover: Video", {
          name: "voiceover",
          color: "orange",
          icon: "mic",
        }),
        session("B-roll: Video", {
          name: " B-roll ",
          color: "lime",
          icon: "camera",
        }),
        session("Publishing: Video"),
      ],
    });

    expect(prismaMock.contentCustomType.update).toHaveBeenCalledWith({
      where: { id: "t-voice" },
      data: { color: "orange", icon: "mic" },
    });
    expect(prismaMock.contentCustomType.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.contentCustomType.create).toHaveBeenCalledWith({
      data: { userId: USER, name: "B-roll", color: "lime", icon: "camera" },
      select: { id: true },
    });
    expect(
      createdEvents().map((e: any) => [e.type, e.customTypeId ?? null]),
    ).toEqual([
      ["OTHER", "t-voice"],
      ["OTHER", "new1"],
      ["RECORDING", null], // untouched built-in step keeps its type
    ]);
  });

  it("does not rewrite a type whose look already matches", async () => {
    prismaMock.contentCustomType.findMany.mockResolvedValue([
      { id: "t1", name: "Podcast", color: "teal", icon: "mic" },
    ]);
    await service.createProject(USER, {
      title: "Video",
      events: [session("x", { name: "Podcast", color: "teal", icon: "mic" })],
    });
    expect(prismaMock.contentCustomType.update).not.toHaveBeenCalled();
  });

  it("respects the custom-type limit before creating anything", async () => {
    prismaMock.contentCustomType.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({
        id: `t${i}`,
        name: `T${i}`,
        color: "teal",
        icon: "tag",
      })),
    );
    await expect(
      service.createProject(USER, {
        title: "Video",
        events: [session("x", { name: "Brand new", color: "teal" })],
      }),
    ).rejects.toThrow("up to 30 custom types");
    expect(prismaMock.contentCustomType.create).not.toHaveBeenCalled();
    expect(prismaMock.contentProject.create).not.toHaveBeenCalled();
  });
});

describe("production steps template", () => {
  const step = (over: Record<string, unknown> = {}) => ({
    baseType: "RECORDING" as const,
    name: null,
    color: null,
    icon: null,
    durationMinutes: 120,
    enabled: true,
    isPublish: false,
    ...over,
  });

  it("returns the saved steps in order", async () => {
    prismaMock.contentProductionStep.findMany.mockResolvedValue([]);
    expect(await service.getProductionSteps(USER)).toEqual([]);
    expect(prismaMock.contentProductionStep.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER },
        orderBy: { position: "asc" },
      }),
    );
  });

  it("replaces the whole list atomically, keeping the given order", async () => {
    prismaMock.contentProductionStep.findMany.mockResolvedValue([]);
    await service.saveProductionSteps(USER, [
      step({
        baseType: undefined,
        name: "  Voice   over ",
        color: "orange",
        icon: "mic",
      }),
      step(),
      step({ baseType: "PUBLISHING", isPublish: true, durationMinutes: 30 }),
    ]);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.contentProductionStep.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER },
    });
    const { data } =
      prismaMock.contentProductionStep.createMany.mock.calls[0][0];
    expect(
      data.map((d: any) => [d.position, d.baseType, d.name, d.isPublish]),
    ).toEqual([
      [0, null, "Voice over", false],
      [1, "RECORDING", null, false],
      [2, "PUBLISHING", null, true],
    ]);
    expect(data.every((d: any) => d.userId === USER)).toBe(true);
  });

  it("rejects unnamed added steps and more than one publishing step", async () => {
    await expect(
      service.saveProductionSteps(USER, [
        step({ baseType: undefined, name: "   " }),
      ]),
    ).rejects.toThrow("Every added step needs a name");
    await expect(
      service.saveProductionSteps(USER, [
        step({ isPublish: true }),
        step({ isPublish: true }),
      ]),
    ).rejects.toThrow("Only one step can be the publishing step");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
