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
import {
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";
import { useDashboardLayoutStore } from "@/store/dashboard-layout.store";
import {
  readCachedLayout,
  writeCachedLayout,
} from "@/lib/dashboard-widgets/layout-cache";
import { visibleWidgetIds } from "@/lib/dashboard-widgets/layout";

const apiMock = vi.mocked(api);
const store = () => useDashboardLayoutStore.getState();
const ids = (widgets: readonly { id: string }[]) => widgets.map((w) => w.id);

/** The default layout with the given widgets moved to the front. */
const custom = (...front: DashboardWidgetState[]): DashboardWidgetState[] => [
  ...front,
  ...DEFAULT_DASHBOARD_WIDGETS.filter(
    (w) => !front.some((f) => f.id === w.id),
  ).map((w) => ({ ...w })),
];

function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets queued saves run. */
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  vi.resetAllMocks();
  localStorage.clear();
  await flush(); // previous test's queue
  useDashboardLayoutStore.setState(
    useDashboardLayoutStore.getInitialState(),
    true,
  );
});

describe("loading", () => {
  it("paints the cached layout at once, then takes the API's", async () => {
    writeCachedLayout("u1", custom({ id: "tips", visible: true }));
    const request = deferred();
    apiMock.get.mockReturnValue(request.promise as never);

    const loading = store().load("u1");

    // Cache: hydrated right away, in the user's order.
    expect(store().isHydrated).toBe(true);
    expect(store().widgets[0]).toEqual({ id: "tips", visible: true });

    request.resolve({
      widgets: custom({ id: "activity", visible: true }),
      updatedAt: "2026-11-20T10:00:00.000Z",
    });
    await loading;

    expect(apiMock.get).toHaveBeenCalledWith("/user/dashboard-layout");
    expect(store().widgets[0]).toEqual({ id: "activity", visible: true });
    expect(readCachedLayout("u1")![0]).toEqual({
      id: "activity",
      visible: true,
    });
  });

  it("without a cache, waits for the API before saying it's hydrated", async () => {
    const request = deferred();
    apiMock.get.mockReturnValue(request.promise as never);

    const loading = store().load("u1");
    expect(store().isHydrated).toBe(false);

    request.resolve({ widgets: DEFAULT_DASHBOARD_WIDGETS, updatedAt: null });
    await loading;
    expect(store().isHydrated).toBe(true);
  });

  it("normalizes whatever the API answers (an older API, a bad body)", async () => {
    apiMock.get.mockResolvedValue({});
    await store().load("u1");

    expect(store().widgets).toEqual([...DEFAULT_DASHBOARD_WIDGETS]);
    expect(store().isHydrated).toBe(true);
  });

  it("keeps the cached/default layout usable when the request fails", async () => {
    writeCachedLayout("u1", custom({ id: "tips", visible: true }));
    apiMock.get.mockRejectedValue(new Error("offline"));

    await store().load("u1");

    expect(store().isHydrated).toBe(true);
    expect(store().widgets[0]!.id).toBe("tips");
  });

  it("never shows one user's cached layout to another", async () => {
    writeCachedLayout("u1", custom({ id: "tips", visible: true }));
    apiMock.get.mockReturnValue(new Promise(() => {}) as never);

    void store().load("u2");

    expect(store().ownerId).toBe("u2");
    expect(store().isHydrated).toBe(false);
    expect(store().widgets).toEqual([...DEFAULT_DASHBOARD_WIDGETS]);
  });

  it("does nothing for signed-out visitors", async () => {
    await store().load(null);
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it("doesn't overwrite a change made while the layout was loading", async () => {
    const request = deferred();
    const save = deferred();
    apiMock.get.mockReturnValue(request.promise as never);
    apiMock.put.mockReturnValue(save.promise as never);

    const loading = store().load("u1");
    store().setVisible("credits", true);
    request.resolve({ widgets: DEFAULT_DASHBOARD_WIDGETS, updatedAt: null });
    await loading;

    expect(store().widgets.find((w) => w.id === "credits")!.visible).toBe(true);
    save.resolve({}); // writes are serial: let the next tests' saves run
    await flush();
  });
});

describe("changes", () => {
  beforeEach(async () => {
    apiMock.get.mockResolvedValue({
      widgets: DEFAULT_DASHBOARD_WIDGETS,
      updatedAt: null,
    });
    await store().load("u1");
    apiMock.put.mockResolvedValue({});
  });

  it("shows a change at once, caches it and saves the whole list", async () => {
    store().setVisible("credits", true);

    expect(store().widgets.find((w) => w.id === "credits")!.visible).toBe(true);
    expect(readCachedLayout("u1")!.find((w) => w.id === "credits")).toEqual({
      id: "credits",
      visible: true,
    });
    await flush();

    expect(apiMock.put).toHaveBeenCalledTimes(1);
    expect(apiMock.put).toHaveBeenCalledWith("/user/dashboard-layout", {
      widgets: store().widgets,
    });
    expect(store().saved).toBe(store().widgets);
  });

  it("reorders the visible widgets (a drag)", async () => {
    const order = visibleWidgetIds(store().widgets).reverse();
    store().reorderVisible(order);

    expect(visibleWidgetIds(store().widgets)).toEqual(order);
    await flush();
    expect(apiMock.put).toHaveBeenCalledTimes(1);
  });

  it("moves a widget and doesn't save no-ops", async () => {
    store().move("quick-prompt", -1); // already first
    await flush();
    expect(apiMock.put).not.toHaveBeenCalled();

    store().move("quick-prompt", 1);
    expect(ids(store().widgets).slice(0, 2)).toEqual([
      "favorites",
      "quick-prompt",
    ]);
    await flush();
    expect(apiMock.put).toHaveBeenCalledTimes(1);
  });

  it("sends one request at a time, then only the latest layout", async () => {
    const first = deferred();
    apiMock.put.mockReturnValueOnce(first.promise as never);

    store().setVisible("credits", true);
    await flush();
    store().setVisible("tips", false);
    store().setVisible("activity", false);
    await flush();
    expect(apiMock.put).toHaveBeenCalledTimes(1); // still in flight

    first.resolve({});
    await flush();
    await flush();

    expect(apiMock.put).toHaveBeenCalledTimes(2);
    const latest = apiMock.put.mock.calls[1]![1] as {
      widgets: DashboardWidgetState[];
    };
    expect(latest.widgets).toEqual(store().widgets);
    expect(store().isSaving).toBe(false);
  });

  it("puts the saved layout back and reports it when a save fails", async () => {
    const before = store().widgets;
    apiMock.put.mockRejectedValueOnce(new Error("500"));

    store().setVisible("favorites", false);
    await flush();

    expect(store().widgets).toEqual(before);
    expect(readCachedLayout("u1")).toEqual(before);
    expect(store().saveErrors).toBe(1);
  });

  it("a failed save keeps newer changes (they are saved next)", async () => {
    const first = deferred();
    apiMock.put.mockReturnValueOnce(first.promise as never);

    store().setVisible("favorites", false);
    await flush();
    store().setVisible("credits", true); // while the first save is running
    first.reject(new Error("500"));
    await flush();
    await flush();

    expect(store().saveErrors).toBe(1);
    expect(store().widgets.find((w) => w.id === "credits")!.visible).toBe(true);
    expect(apiMock.put).toHaveBeenCalledTimes(2);
  });

  it("Undo puts a previous list back", async () => {
    const before = store().widgets;
    store().setVisible("activity", false);
    store().replace(before);

    expect(store().widgets).toEqual(before);
  });

  it("reset shows the default and deletes the saved layout", async () => {
    store().setVisible("credits", true);
    await flush();
    apiMock.delete.mockResolvedValue({});

    await store().reset();

    expect(store().widgets).toEqual([...DEFAULT_DASHBOARD_WIDGETS]);
    expect(apiMock.delete).toHaveBeenCalledWith("/user/dashboard-layout");
    expect(store().saved).toEqual([...DEFAULT_DASHBOARD_WIDGETS]);
  });

  it("a reset waits for a running save (no stale layout wins)", async () => {
    const save = deferred();
    apiMock.put.mockReturnValueOnce(save.promise as never);
    apiMock.delete.mockResolvedValue({});

    store().setVisible("credits", true);
    await flush();
    const resetting = store().reset();
    await flush();
    expect(apiMock.delete).not.toHaveBeenCalled();

    save.resolve({});
    await resetting;
    expect(apiMock.delete).toHaveBeenCalledTimes(1);
    expect(store().widgets).toEqual([...DEFAULT_DASHBOARD_WIDGETS]);
  });
});
