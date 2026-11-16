import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

type Handler = (payload: unknown) => void;
const fakeSocket = vi.hoisted(() => {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    connected: true,
    on: (event: string, fn: Handler) => handlers.set(event, fn),
    off: (event: string) => handlers.delete(event),
    connect: () => undefined,
  };
});

vi.mock("@/lib/socket", () => ({ connectSocket: () => fakeSocket }));
vi.mock("sonner", () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { toast } from "sonner";
import { useSocketEvents } from "@/hooks/use-socket-events";
import { useContentPlannerStore } from "@/store/content-planner.store";
import { routerMock } from "./mocks/next-navigation";

/** The "Open in planner" action of the n-th toast. */
function toastAction(n = 0): () => void {
  const options = vi.mocked(toast.info).mock.calls[n]?.[1] as
    | { action?: { onClick?: () => void } }
    | undefined;
  const onClick = options?.action?.onClick;
  if (!onClick) throw new Error("toast has no action");
  return onClick;
}

function Harness({ onNew }: { onNew?: (n: unknown) => void }) {
  useSocketEvents({ onNotificationNew: onNew });
  return null;
}

const start = new Date(2026, 2, 4, 10, 0); // local time
const reminder = {
  id: "n1",
  type: "SESSION_REMINDER",
  title: "Upcoming session",
  body: '"Record intro" starts in 15 minutes',
  createdAt: new Date(start.getTime() - 15 * 60_000).toISOString(),
  data: {
    kind: "session-reminder",
    eventId: "e1",
    eventTitle: "Record intro",
    startAt: start.toISOString(),
    endAt: new Date(2026, 2, 4, 12, 0).toISOString(),
    reminderMinutes: 15,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  fakeSocket.handlers.clear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("live session reminders", () => {
  it("pops up the reminder in the user's language with an 'Open in planner' button", () => {
    const onNew = vi.fn();
    render(<Harness onNew={onNew} />);

    fakeSocket.handlers.get("notification:new")!(reminder);

    expect(toast.info).toHaveBeenCalledWith("Upcoming session", {
      description: expect.stringMatching(
        /^You have “Record intro” at .*10:00\sAM — starts in 15m$/,
      ),
      duration: 15_000,
      action: { label: "Open in planner", onClick: expect.any(Function) },
    });
    // The bell gets it too.
    expect(onNew).toHaveBeenCalledWith(reminder);

    toastAction()();
    expect(routerMock.push).toHaveBeenCalledWith(
      `/tools/content-planner?date=${encodeURIComponent(start.toISOString())}`,
    );
  });

  it("jumps to the week directly when the planner is already open", () => {
    window.history.replaceState(null, "", "/tools/content-planner");
    useContentPlannerStore.setState({
      view: "month",
      cursor: new Date(2020, 0, 1),
    });
    render(<Harness />);

    fakeSocket.handlers.get("notification:new")!(reminder);
    toastAction()();

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(useContentPlannerStore.getState().view).toBe("week");
    expect(useContentPlannerStore.getState().cursor).toEqual(start);
  });

  it("keeps the usual toast for other notifications", () => {
    render(<Harness />);
    fakeSocket.handlers.get("notification:new")!({
      id: "n2",
      type: "ASSET_LIKE",
      title: "New Like",
      body: "Someone liked your asset",
      data: null,
    });
    expect(toast.info).toHaveBeenCalledWith("New Like", {
      description: "Someone liked your asset",
    });
  });
});
