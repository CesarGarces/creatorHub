/**
 * Page-level check of the resize flow: dragging an edge in the real page
 * sends one PATCH with the new times, shows the result at once, confirms
 * with a toast and refreshes the calendar-wide totals.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/hooks/use-socket-events", () => ({ useSocketEvents: () => {} }));
vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { toast } from "sonner";
import api from "@/lib/api";
import ContentPlannerPage from "@/app/(authed)/tools/content-planner/page";
import { useContentPlannerStore } from "@/store/content-planner.store";
import type { ContentEvent } from "@/lib/content-planner/types";

const apiMock = vi.mocked(api);
const HOUR_PX = 48;

const recording: ContentEvent = {
  id: "rec",
  projectId: null,
  title: "Record intro",
  type: "RECORDING",
  status: "PLANNED",
  startAt: new Date(2026, 2, 3, 10, 0).toISOString(), // Tue 10:00 – 12:00
  endAt: new Date(2026, 2, 3, 12, 0).toISOString(),
  notes: null,
};

let stats = { sessions: 1, plannedMinutes: 120, done: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  useContentPlannerStore.setState(
    useContentPlannerStore.getInitialState(),
    true,
  );
  useContentPlannerStore.setState({ cursor: new Date(2026, 2, 4, 9, 0) });
  stats = { sessions: 1, plannedMinutes: 120, done: 0 };
  apiMock.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/events")) return { data: [recording] };
    if (path.endsWith("/stats")) return { data: stats };
    return { data: [] };
  });
});

describe("Content Planner page — resizing", () => {
  it("saves the new end time through the API when the edge is released", async () => {
    apiMock.patch.mockImplementation(async (_path: string, body: unknown) => {
      stats = { sessions: 1, plannedMinutes: 210, done: 0 };
      return { data: { ...recording, ...(body as object) }, conflicts: [] };
    });
    render(<ContentPlannerPage />);

    const block = await screen.findByRole("button", { name: /Record intro/ });
    await waitFor(() =>
      expect(screen.getByText("Hours planned").nextSibling?.textContent).toBe(
        "2h",
      ),
    );

    fireEvent.pointerDown(screen.getByTestId("resize-end-rec"), {
      button: 0,
      clientY: 300,
    });
    fireEvent.pointerMove(window, { clientY: 300 + 1.5 * HOUR_PX });
    fireEvent.pointerUp(window);

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledTimes(1));
    expect(apiMock.patch).toHaveBeenCalledWith(
      "/tools/content-planner/events/rec",
      {
        startAt: new Date(2026, 2, 3, 10, 0).toISOString(),
        endAt: new Date(2026, 2, 3, 13, 30).toISOString(),
      },
    );
    // Shown right away (optimistic) and kept after the response.
    expect(block.style.height).toBe(`${3.5 * HOUR_PX}px`);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringMatching(/^Session updated: 10:00\sAM – 1:30\sPM$/),
      ),
    );
    // Totals refreshed from the API after the save.
    await waitFor(() =>
      expect(screen.getByText("Hours planned").nextSibling?.textContent).toBe(
        "3h 30m",
      ),
    );
  });

  it("puts the session back and reports the error when saving fails", async () => {
    apiMock.patch.mockRejectedValue(
      new Error("A session can't be longer than 24 hours"),
    );
    render(<ContentPlannerPage />);
    const block = await screen.findByRole("button", { name: /Record intro/ });

    fireEvent.pointerDown(screen.getByTestId("resize-start-rec"), {
      button: 0,
      clientY: 300,
    });
    fireEvent.pointerMove(window, { clientY: 300 - HOUR_PX });
    fireEvent.pointerUp(window);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "A session can't be longer than 24 hours",
      ),
    );
    expect(block.style.top).toBe(`${10 * HOUR_PX}px`);
    expect(block.style.height).toBe(`${2 * HOUR_PX}px`);
  });
});

describe("Content Planner page — opened from a reminder", () => {
  it("shows the week of ?date= and cleans the URL", async () => {
    useContentPlannerStore.setState({ view: "month" });
    const sessionStart = new Date(2030, 2, 6, 10, 0); // Wed 6 March 2030
    window.history.replaceState(
      null,
      "",
      `/tools/content-planner?date=${encodeURIComponent(sessionStart.toISOString())}`,
    );

    render(<ContentPlannerPage />);

    await waitFor(() =>
      expect(useContentPlannerStore.getState().cursor).toEqual(sessionStart),
    );
    expect(useContentPlannerStore.getState().view).toBe("week");
    expect(window.location.search).toBe("");
    // The events request covers that week.
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(
        "/tools/content-planner/events",
        {
          params: {
            from: new Date(2030, 2, 4).toISOString(),
            to: new Date(2030, 2, 11).toISOString(),
          },
        },
      ),
    );
  });

  it("ignores an invalid date", () => {
    const cursor = useContentPlannerStore.getState().cursor;
    window.history.replaceState(null, "", "/tools/content-planner?date=soon");
    render(<ContentPlannerPage />);
    expect(useContentPlannerStore.getState().cursor).toBe(cursor);
    expect(window.location.search).toBe("");
  });
});

describe("Content Planner page — AI planner", () => {
  it("“Plan with AI” opens the assistant with the text-model selector", async () => {
    render(<ContentPlannerPage />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Plan with AI" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "AI planning assistant",
    });
    expect(dialog.textContent).toContain("Your idea");
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith("/ai/models", {
        params: { taskTypes: "text-generation" },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "AI planning assistant" }),
      ).toBeNull(),
    );
  });
});
