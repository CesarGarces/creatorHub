import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "@/lib/api";
import { useContentPlannerStore } from "@/store/content-planner.store";
import type { ContentEvent } from "@/lib/content-planner/types";

const apiMock = vi.mocked(api);

const event = (
  id: string,
  startAt: string,
  extra: Partial<ContentEvent> = {},
): ContentEvent => ({
  id,
  projectId: null,
  title: id,
  type: "RECORDING",
  status: "PLANNED",
  startAt,
  endAt: startAt.replace("T10", "T11"),
  notes: null,
  ...extra,
});

/** A promise we resolve/reject from the test. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  useContentPlannerStore.setState(
    useContentPlannerStore.getInitialState(),
    true,
  );
  useContentPlannerStore.setState({ cursor: new Date(2026, 2, 4, 15, 0) }); // Wed
});

describe("content planner store", () => {
  it("loads the visible week (Monday to Monday)", async () => {
    apiMock.get.mockResolvedValue({
      data: [event("a", "2026-03-03T10:00:00.000Z")],
    });

    await useContentPlannerStore.getState().fetchEvents();

    expect(apiMock.get).toHaveBeenCalledWith("/tools/content-planner/events", {
      params: {
        from: new Date(2026, 2, 2).toISOString(),
        to: new Date(2026, 2, 9).toISOString(),
      },
    });
    expect(useContentPlannerStore.getState().events).toHaveLength(1);
  });

  it("ignores a slow response to a week the user already left", async () => {
    const slow = deferred<{ data: ContentEvent[] }>();
    apiMock.get.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({
      data: [event("next-week", "2026-03-10T10:00:00.000Z")],
    });

    const store = useContentPlannerStore.getState();
    const first = store.fetchEvents();
    store.shift(1);
    await useContentPlannerStore.getState().fetchEvents();
    slow.resolve({ data: [event("stale", "2026-03-03T10:00:00.000Z")] });
    await first;

    expect(useContentPlannerStore.getState().events.map((e) => e.id)).toEqual([
      "next-week",
    ]);
  });

  it("applies updates optimistically and rolls back on failure", async () => {
    useContentPlannerStore.setState({
      events: [event("a", "2026-03-03T10:00:00.000Z")],
    });
    const request = deferred<never>();
    apiMock.patch.mockReturnValue(request.promise);

    const pending = useContentPlannerStore
      .getState()
      .updateEvent("a", { status: "DONE" });
    expect(useContentPlannerStore.getState().events[0]?.status).toBe("DONE");

    request.reject(new Error("boom"));
    await expect(pending).rejects.toThrow("boom");
    expect(useContentPlannerStore.getState().events[0]?.status).toBe("PLANNED");
  });

  it("inserts created sessions in chronological order and returns overlaps", async () => {
    useContentPlannerStore.setState({
      events: [event("late", "2026-03-05T10:00:00.000Z")],
    });
    const conflict = {
      id: "late",
      title: "late",
      type: "RECORDING",
      startAt: "",
      endAt: "",
    };
    apiMock.post.mockResolvedValue({
      data: event("early", "2026-03-03T10:00:00.000Z"),
      conflicts: [conflict],
    });

    const conflicts = await useContentPlannerStore.getState().createEvent({
      title: "early",
      type: "RECORDING",
      startAt: "2026-03-03T10:00:00.000Z",
      endAt: "2026-03-03T11:00:00.000Z",
    });

    expect(conflicts).toEqual([conflict]);
    expect(useContentPlannerStore.getState().events.map((e) => e.id)).toEqual([
      "early",
      "late",
    ]);
  });

  it("drops a deleted project's sessions and clears its highlight", async () => {
    apiMock.delete.mockResolvedValue(undefined);
    useContentPlannerStore.setState({
      focusedProjectId: "p1",
      projects: [
        {
          id: "p1",
          title: "Video",
          platform: null,
          publishAt: null,
          notes: null,
          progress: { total: 1, done: 0 },
          nextEvent: null,
        },
      ],
      events: [
        event("in-project", "2026-03-03T10:00:00.000Z", { projectId: "p1" }),
        event("standalone", "2026-03-04T10:00:00.000Z"),
      ],
    });

    await useContentPlannerStore.getState().deleteProject("p1");

    const state = useContentPlannerStore.getState();
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/tools/content-planner/projects/p1",
    );
    expect(state.events.map((e) => e.id)).toEqual(["standalone"]);
    expect(state.projects).toEqual([]);
    expect(state.focusedProjectId).toBeNull();
  });
});

describe("calendar-wide stats", () => {
  it("loads the totals from the API", async () => {
    apiMock.get.mockResolvedValue({
      data: { sessions: 3, plannedMinutes: 240, done: 1 },
    });

    await useContentPlannerStore.getState().fetchStats();

    expect(apiMock.get).toHaveBeenCalledWith("/tools/content-planner/stats");
    expect(useContentPlannerStore.getState().stats).toEqual({
      sessions: 3,
      plannedMinutes: 240,
      done: 1,
    });
  });

  it.each([
    [
      "createEvent",
      () =>
        useContentPlannerStore.getState().createEvent({
          title: "x",
          type: "OTHER",
          startAt: "2026-03-03T10:00:00.000Z",
          endAt: "2026-03-03T11:00:00.000Z",
        }),
    ],
    [
      "updateEvent",
      () =>
        useContentPlannerStore.getState().updateEvent("a", { status: "DONE" }),
    ],
    ["deleteEvent", () => useContentPlannerStore.getState().deleteEvent("a")],
  ])("refreshes the totals after %s", async (_name, mutate) => {
    useContentPlannerStore.setState({
      events: [event("a", "2026-03-03T10:00:00.000Z")],
    });
    apiMock.post.mockResolvedValue({
      data: event("b", "2026-03-03T10:00:00.000Z"),
      conflicts: [],
    });
    apiMock.patch.mockResolvedValue({
      data: event("a", "2026-03-03T10:00:00.000Z"),
      conflicts: [],
    });
    apiMock.delete.mockResolvedValue(undefined);
    apiMock.get.mockResolvedValue({
      data: { sessions: 9, plannedMinutes: 60, done: 2 },
    });

    await mutate();

    await vi.waitFor(() =>
      expect(useContentPlannerStore.getState().stats).toEqual({
        sessions: 9,
        plannedMinutes: 60,
        done: 2,
      }),
    );
  });

  it("keeps the last totals when the refresh fails", async () => {
    useContentPlannerStore.setState({
      stats: { sessions: 1, plannedMinutes: 30, done: 0 },
    });
    apiMock.get.mockRejectedValue(new Error("offline"));

    await useContentPlannerStore.getState().fetchStats();

    expect(useContentPlannerStore.getState().stats?.sessions).toBe(1);
  });
});

describe("custom types", () => {
  it("creates a type and appends it to the list", async () => {
    apiMock.post.mockResolvedValue({
      data: { id: "t1", name: "Podcast", color: "teal" },
    });

    const created = await useContentPlannerStore
      .getState()
      .createCustomType("Podcast", "teal");

    // Icon defaults to "tag".
    expect(apiMock.post).toHaveBeenCalledWith("/tools/content-planner/types", {
      name: "Podcast",
      color: "teal",
      icon: "tag",
    });
    expect(created.id).toBe("t1");
    expect(useContentPlannerStore.getState().customTypes).toEqual([created]);
  });

  it("deleting a type turns its sessions into plain Other, like the API", async () => {
    apiMock.delete.mockResolvedValue(undefined);
    apiMock.get.mockResolvedValue({ data: [] });
    const podcast = { id: "t1", name: "Podcast", color: "teal" };
    useContentPlannerStore.setState({
      customTypes: [podcast],
      events: [
        event("ep", "2026-03-03T10:00:00.000Z", {
          type: "OTHER",
          customTypeId: "t1",
          customType: podcast,
        }),
        event("rec", "2026-03-04T10:00:00.000Z"),
      ],
    });

    await useContentPlannerStore.getState().deleteCustomType("t1");

    const state = useContentPlannerStore.getState();
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/tools/content-planner/types/t1",
    );
    expect(state.customTypes).toEqual([]);
    expect(state.events[0]).toMatchObject({
      id: "ep",
      type: "OTHER",
      customTypeId: null,
      customType: null,
    });
    expect(state.events[1]?.type).toBe("RECORDING");
  });
});

describe("custom platforms", () => {
  it("loads, creates and deletes platforms; projects on a deleted one lose it", async () => {
    apiMock.get.mockResolvedValue({ data: [{ id: "pl0", name: "Rumble" }] });
    await useContentPlannerStore.getState().fetchCustomPlatforms();
    expect(apiMock.get).toHaveBeenCalledWith(
      "/tools/content-planner/platforms",
    );

    apiMock.post.mockResolvedValue({ data: { id: "pl1", name: "Kick" } });
    await useContentPlannerStore.getState().createCustomPlatform("Kick");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/tools/content-planner/platforms",
      {
        name: "Kick",
      },
    );
    expect(
      useContentPlannerStore.getState().customPlatforms.map((p) => p.name),
    ).toEqual(["Rumble", "Kick"]);

    useContentPlannerStore.setState({
      projects: [
        {
          id: "p1",
          title: "Video",
          platform: null,
          customPlatformId: "pl1",
          customPlatform: { id: "pl1", name: "Kick" },
          publishAt: null,
          notes: null,
          progress: { total: 0, done: 0 },
          nextEvent: null,
        },
      ],
    });
    apiMock.delete.mockResolvedValue(undefined);
    await useContentPlannerStore.getState().deleteCustomPlatform("pl1");

    const state = useContentPlannerStore.getState();
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/tools/content-planner/platforms/pl1",
    );
    expect(state.customPlatforms.map((p) => p.id)).toEqual(["pl0"]);
    expect(state.projects[0]).toMatchObject({
      customPlatformId: null,
      customPlatform: null,
    });
  });
});

describe("production steps template", () => {
  const saved = [
    {
      baseType: null,
      name: "Voiceover",
      color: "orange",
      icon: "mic",
      durationMinutes: 45,
      enabled: true,
      isPublish: false,
    },
  ];

  it("starts unloaded, then loads the saved steps", async () => {
    expect(useContentPlannerStore.getState().productionSteps).toBeNull();
    apiMock.get.mockResolvedValue({ data: saved });
    await useContentPlannerStore.getState().fetchProductionSteps();
    expect(apiMock.get).toHaveBeenCalledWith("/tools/content-planner/steps");
    expect(useContentPlannerStore.getState().productionSteps).toEqual(saved);
  });

  it("falls back to the built-in steps when loading fails", async () => {
    apiMock.get.mockRejectedValue(new Error("offline"));
    await useContentPlannerStore.getState().fetchProductionSteps();
    expect(useContentPlannerStore.getState().productionSteps).toEqual([]);
  });

  it("saves the whole list with PUT and keeps the server's copy", async () => {
    apiMock.put.mockResolvedValue({ data: [{ id: "s1", ...saved[0] }] });
    await useContentPlannerStore.getState().saveProductionSteps(saved as never);
    expect(apiMock.put).toHaveBeenCalledWith("/tools/content-planner/steps", {
      steps: saved,
    });
    expect(
      useContentPlannerStore.getState().productionSteps?.[0],
    ).toMatchObject({
      id: "s1",
      name: "Voiceover",
    });
  });

  it("refreshes custom types after creating a plan (steps may have made new ones)", async () => {
    apiMock.post.mockResolvedValue({ data: { id: "p1" }, conflicts: [] });
    apiMock.get.mockImplementation(async (path: string) =>
      path.endsWith("/types")
        ? {
            data: [
              { id: "t1", name: "Voiceover", color: "orange", icon: "mic" },
            ],
          }
        : { data: path.endsWith("/stats") ? null : [] },
    );

    await useContentPlannerStore.getState().createProject({ title: "Video" });

    expect(apiMock.get).toHaveBeenCalledWith("/tools/content-planner/types");
    expect(useContentPlannerStore.getState().customTypes[0]?.name).toBe(
      "Voiceover",
    );
  });
});
