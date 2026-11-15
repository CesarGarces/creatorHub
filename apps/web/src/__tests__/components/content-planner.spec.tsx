import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { toast } from "sonner";
import { WeekView } from "@/components/content-planner/week-view";
import { EventDialog } from "@/components/content-planner/event-dialog";
import { PlannerStats } from "@/components/content-planner/planner-stats";
import { I18nProvider } from "@/i18n/i18n-provider";
import { __resetClientLocaleForTests } from "@/i18n/runtime";
import { MonthView } from "@/components/content-planner/month-view";
import { AgendaView } from "@/components/content-planner/agenda-view";
import { place } from "@/components/content-planner/event-tooltip";
import {
  customTypeValue,
  parseTypeValue,
} from "@/components/content-planner/type-field";
import { useContentPlannerStore } from "@/store/content-planner.store";
import type { ContentEvent } from "@/lib/content-planner/types";

const HOUR_PX = 48; // keep in sync with week-view.tsx
const wednesday = new Date(2026, 2, 4, 9, 0);

const recording: ContentEvent = {
  id: "rec",
  projectId: null,
  title: "Record intro",
  type: "RECORDING",
  status: "PLANNED",
  startAt: new Date(2026, 2, 3, 10, 0).toISOString(), // Tue 10:00
  endAt: new Date(2026, 2, 3, 12, 0).toISOString(),
  notes: null,
};

const actions = {
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  createProject: vi.fn(),
  createCustomType: vi.fn(),
  deleteCustomType: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useContentPlannerStore.setState(
    useContentPlannerStore.getInitialState(),
    true,
  );
  useContentPlannerStore.setState(actions);
  actions.createEvent.mockResolvedValue([]);
  actions.updateEvent.mockResolvedValue([]);
  actions.createProject.mockResolvedValue({ projectId: "p1", conflicts: [] });
});

/** jsdom has no DragEvent: build the event and attach the fields we read. */
function drag(
  element: Element,
  type: "dragStart" | "dragOver" | "drop",
  clientY: number,
) {
  const event = createEvent[type](element);
  Object.defineProperties(event, {
    clientY: { value: clientY },
    dataTransfer: {
      value: { setData: vi.fn(), effectAllowed: "", dropEffect: "" },
    },
  });
  fireEvent(element, event);
}

describe("WeekView", () => {
  function renderWeek() {
    const props = {
      onSelectEvent: vi.fn(),
      onCreateAt: vi.fn(),
      onMoveEvent: vi.fn(),
      onResizeEvent: vi.fn(),
    };
    render(
      <WeekView
        cursor={wednesday}
        events={[recording]}
        focusedProjectId={null}
        {...props}
      />,
    );
    return props;
  }

  it("places sessions in their day column and opens them on click", () => {
    const props = renderWeek();
    const tuesday = screen.getByTestId("planner-day-1");
    const block = within(tuesday).getByRole("button", { name: /Record intro/ });

    expect(block.style.top).toBe(`${10 * HOUR_PX}px`);
    expect(block.style.height).toBe(`${2 * HOUR_PX}px`);

    fireEvent.click(block);
    expect(props.onSelectEvent).toHaveBeenCalledWith(recording);
    expect(props.onCreateAt).not.toHaveBeenCalled();
  });

  it("creates a session at the clicked half hour", () => {
    const props = renderWeek();
    // Column rect.top is 0 in jsdom: 14:40 → snapped down to 14:30.
    fireEvent.click(screen.getByTestId("planner-day-3"), {
      clientY: (14 + 40 / 60) * HOUR_PX,
    });
    expect(props.onCreateAt).toHaveBeenCalledWith(new Date(2026, 2, 5, 14, 30));
  });

  it("reschedules a session by dragging it to another day and time", () => {
    const props = renderWeek();
    const block = screen.getByRole("button", { name: /Record intro/ });
    const friday = screen.getByTestId("planner-day-4");

    // Grabbed at its top edge, dropped at 16:05 → snapped to 16:00.
    drag(block, "dragStart", 0);
    drag(friday, "dragOver", (16 + 5 / 60) * HOUR_PX);
    expect(within(friday).getByText(/4:00|16:00/)).toBeTruthy(); // drop preview
    drag(friday, "drop", (16 + 5 / 60) * HOUR_PX);

    expect(props.onMoveEvent).toHaveBeenCalledWith(
      recording,
      new Date(2026, 2, 6, 16, 0),
    );
  });
});

describe("EventDialog", () => {
  it("requires a title before saving", async () => {
    render(
      <EventDialog
        target={{ mode: "create", start: new Date(2026, 2, 4, 10, 0) }}
        projects={[]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Give the session a title",
    );
    expect(actions.createEvent).not.toHaveBeenCalled();
  });

  it("creates a late-night session that ends the next day", async () => {
    const onClose = vi.fn();
    render(
      <EventDialog
        target={{ mode: "create", start: new Date(2026, 2, 4, 22, 0) }}
        projects={[]}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "  Late stream  " },
    });
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "LIVESTREAM" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "01:30" },
    });
    expect(screen.getByText("Ends the next day")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.createEvent).toHaveBeenCalledWith({
      title: "Late stream",
      type: "LIVESTREAM",
      startAt: new Date(2026, 2, 4, 22, 0).toISOString(),
      endAt: new Date(2026, 2, 5, 1, 30).toISOString(),
    });
    expect(toast.success).toHaveBeenCalledWith("Session created");
  });

  it("edits a session, clearing its project and notes, and warns about overlaps", async () => {
    actions.updateEvent.mockResolvedValue([
      {
        id: "other",
        title: "Sponsor call",
        type: "OTHER",
        startAt: recording.startAt,
        endAt: recording.endAt,
      },
    ]);
    render(
      <EventDialog
        target={{
          mode: "edit",
          event: { ...recording, projectId: "p1", notes: "old notes" },
        }}
        projects={[
          {
            id: "p1",
            title: "Launch video",
            platform: null,
            publishAt: null,
            notes: null,
            progress: { total: 1, done: 0 },
            nextEvent: null,
          },
        ]}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "DONE" },
    });
    fireEvent.change(screen.getByLabelText("Video project"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(actions.updateEvent).toHaveBeenCalled());
    expect(actions.updateEvent).toHaveBeenCalledWith("rec", {
      title: "Record intro",
      type: "RECORDING",
      status: "DONE",
      startAt: recording.startAt,
      endAt: recording.endAt,
      notes: null,
      projectId: null,
      customTypeId: null,
    });
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith(
        "Overlaps with “Sponsor call”",
        expect.anything(),
      ),
    );
  });
});

describe("custom session types", () => {
  const podcast = { id: "t1", name: "Podcast", color: "orange" };

  beforeEach(() => {
    // Like the real store: the new type is appended to the list.
    actions.createCustomType.mockImplementation(
      async (name: string, color: string) => {
        const created = { id: "t1", name, color };
        useContentPlannerStore.setState((s) => ({
          customTypes: [...s.customTypes, created],
        }));
        return created;
      },
    );
    actions.deleteCustomType.mockImplementation(async (id: string) => {
      useContentPlannerStore.setState((s) => ({
        customTypes: s.customTypes.filter((t) => t.id !== id),
      }));
    });
  });

  function renderCreate() {
    render(
      <EventDialog
        target={{ mode: "create", start: new Date(2026, 2, 4, 10, 0) }}
        projects={[]}
        onClose={vi.fn()}
      />,
    );
  }

  it("encodes custom types in the select value", () => {
    expect(parseTypeValue("EDITING")).toEqual({
      type: "EDITING",
      customTypeId: null,
    });
    expect(parseTypeValue(customTypeValue("t1"))).toEqual({
      type: "OTHER",
      customTypeId: "t1",
    });
    expect(parseTypeValue("bogus")).toEqual({
      type: "OTHER",
      customTypeId: null,
    });
  });

  it("creates a type with the + button, selects it and saves the session with it", async () => {
    renderCreate();

    fireEvent.click(screen.getByRole("button", { name: "Create custom type" }));
    fireEvent.change(screen.getByLabelText("Type name"), {
      target: { value: "  Podcast " },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Orange" }));
    fireEvent.click(screen.getByRole("button", { name: "Add type" }));

    await waitFor(() =>
      expect(actions.createCustomType).toHaveBeenCalledWith(
        "Podcast",
        "orange",
        "tag",
      ),
    );
    const typeSelect = screen.getByLabelText("Type") as HTMLSelectElement;
    await waitFor(() => expect(typeSelect.value).toBe("custom:t1"));
    expect(
      within(typeSelect).getByRole("group", { name: "Custom types" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Type name")).toBeNull(); // panel closed
    expect(toast.success).toHaveBeenCalledWith("Type “Podcast” created");

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Episode 12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create session" }));

    await waitFor(() => expect(actions.createEvent).toHaveBeenCalled());
    expect(actions.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OTHER", customTypeId: "t1" }),
    );
  });

  it("pressing Enter in the name field creates the type, not the session", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: "Create custom type" }));
    const name = screen.getByLabelText("Type name");
    fireEvent.change(name, { target: { value: "Podcast" } });
    fireEvent.keyDown(name, { key: "Enter" });

    await waitFor(() => expect(actions.createCustomType).toHaveBeenCalled());
    expect(actions.createEvent).not.toHaveBeenCalled();
  });

  it("rejects a blank or duplicate name before calling the API", async () => {
    useContentPlannerStore.setState({ customTypes: [podcast] });
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: "Create custom type" }));

    fireEvent.click(screen.getByRole("button", { name: "Add type" }));
    expect(screen.getByRole("alert").textContent).toBe("Give the type a name");

    fireEvent.change(screen.getByLabelText("Type name"), {
      target: { value: "PODCAST" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add type" }));
    expect(screen.getByRole("alert").textContent).toBe(
      "You already have a type with this name",
    );
    expect(actions.createCustomType).not.toHaveBeenCalled();
  });

  it("shows an API error (e.g. the 30-type limit) translated", async () => {
    actions.createCustomType.mockRejectedValue(
      new Error("You can have up to 30 custom types"),
    );
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: "Create custom type" }));
    fireEvent.change(screen.getByLabelText("Type name"), {
      target: { value: "Vlog" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add type" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You can have up to 30 custom types",
    );
  });

  it("preselects an event's custom type and can delete it, falling back to Other", async () => {
    useContentPlannerStore.setState({ customTypes: [podcast] });
    render(
      <EventDialog
        target={{
          mode: "edit",
          event: {
            ...recording,
            type: "OTHER",
            customTypeId: "t1",
            customType: podcast,
          },
        }}
        projects={[]}
        onClose={vi.fn()}
      />,
    );
    const typeSelect = screen.getByLabelText("Type") as HTMLSelectElement;
    expect(typeSelect.value).toBe("custom:t1");

    fireEvent.click(screen.getByRole("button", { name: "Delete custom type" }));
    expect(screen.getByText("Delete “Podcast”?")).toBeTruthy();
    const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(actions.deleteCustomType).toHaveBeenCalledWith("t1"),
    );
    await waitFor(() => expect(typeSelect.value).toBe("OTHER"));
    expect(
      screen.queryByRole("button", { name: "Delete custom type" }),
    ).toBeNull();
  });

  it("renders custom-typed sessions with their own color", () => {
    render(
      <WeekView
        cursor={wednesday}
        events={[
          {
            ...recording,
            type: "OTHER",
            customTypeId: "t1",
            customType: podcast,
          },
        ]}
        focusedProjectId={null}
        onSelectEvent={vi.fn()}
        onCreateAt={vi.fn()}
        onMoveEvent={vi.fn()}
        onResizeEvent={vi.fn()}
      />,
    );
    const block = screen.getByRole("button", { name: /Record intro/ });
    expect(block.className).toContain("bg-orange-500/15");
    expect(block.className).not.toContain("slate"); // not the plain "Other" style
  });
});

describe("PlannerStats", () => {
  it("formats hours like the plan total, in the interface language", () => {
    const stats = { sessions: 2, plannedMinutes: 675, done: 0 };
    const hours = () =>
      screen
        .getByText(/^(Hours planned|Horas planificadas)$/)
        .parentElement!.querySelector("dd")!.textContent;

    const { unmount } = render(<PlannerStats stats={stats} />);
    expect(hours()).toBe("11h 15m");
    unmount();

    render(
      <I18nProvider initialLocale="es">
        <PlannerStats stats={{ ...stats, plannedMinutes: 60 }} />
      </I18nProvider>,
    );
    expect(hours()).toBe("1 h");
    __resetClientLocaleForTests();
  });

  it("shows placeholders until the totals load", () => {
    render(<PlannerStats stats={null} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("shows the calendar-wide totals", () => {
    render(
      <PlannerStats stats={{ sessions: 12, plannedMinutes: 1290, done: 5 }} />,
    );
    const value = (label: string) =>
      screen.getByText(label).parentElement!.querySelector("dd")!.textContent;

    expect(value("Sessions")).toBe("12");
    expect(value("Hours planned")).toBe("21h 30m");
    expect(value("Completed")).toBe("5");
    expect(
      screen.getByText(
        "Totals across every session in your calendar (cancelled ones excluded).",
      ),
    ).toBeTruthy();
  });
});

// ─── Resizing sessions from their edges ──────────────────────────────

describe("WeekView resizing", () => {
  function renderWeek(events: ContentEvent[] = [recording]) {
    const props = {
      onSelectEvent: vi.fn(),
      onCreateAt: vi.fn(),
      onMoveEvent: vi.fn(),
      onResizeEvent: vi.fn(),
    };
    render(
      <WeekView
        cursor={wednesday}
        events={events}
        focusedProjectId={null}
        {...props}
      />,
    );
    return props;
  }
  const block = () => screen.getByRole("button", { name: /Record intro/ });
  /** Presses an edge and moves the pointer `dy` px (the window listens). */
  function dragEdge(edge: "start" | "end", dy: number, id = "rec") {
    fireEvent.pointerDown(screen.getByTestId(`resize-${edge}-${id}`), {
      button: 0,
      clientY: 500,
    });
    fireEvent.pointerMove(window, { clientY: 500 + dy });
  }

  it("drags the bottom edge to extend the session and saves once on release", () => {
    const props = renderWeek();

    dragEdge("end", 1.5 * HOUR_PX); // +90 min
    // Live preview while dragging, nothing saved yet.
    expect(block().style.height).toBe(`${3.5 * HOUR_PX}px`);
    expect(block().getAttribute("aria-label")).toMatch(/10:00\sAM – 1:30\sPM/);
    expect(props.onResizeEvent).not.toHaveBeenCalled();

    fireEvent.pointerUp(window, { clientY: 500 + 1.5 * HOUR_PX });

    expect(props.onResizeEvent).toHaveBeenCalledTimes(1);
    expect(props.onResizeEvent).toHaveBeenCalledWith(
      recording,
      new Date(2026, 2, 3, 10, 0),
      new Date(2026, 2, 3, 13, 30),
    );
  });

  it("drags the top edge to move the start and keeps the end", () => {
    const props = renderWeek();
    dragEdge("start", -0.75 * HOUR_PX); // -45 min
    expect(block().style.top).toBe(`${9.25 * HOUR_PX}px`);
    fireEvent.pointerUp(window);

    expect(props.onResizeEvent).toHaveBeenCalledWith(
      recording,
      new Date(2026, 2, 3, 9, 15),
      new Date(2026, 2, 3, 12, 0),
    );
  });

  it("snaps to 15 minutes and never shrinks below 15 minutes", () => {
    const props = renderWeek();
    dragEdge("end", -10 * HOUR_PX);
    fireEvent.pointerUp(window);
    expect(props.onResizeEvent).toHaveBeenCalledWith(
      recording,
      new Date(2026, 2, 3, 10, 0),
      new Date(2026, 2, 3, 10, 15),
    );
  });

  it("swallows the click that ends a resize (no dialog, no new session)", () => {
    const props = renderWeek();
    dragEdge("end", HOUR_PX);
    fireEvent.pointerUp(window);
    fireEvent.click(block());
    fireEvent.click(screen.getByTestId("planner-day-1"), { clientY: 900 });

    expect(props.onSelectEvent).not.toHaveBeenCalled();
    expect(props.onCreateAt).not.toHaveBeenCalled();
  });

  it("does nothing when the edge is released without moving", () => {
    const props = renderWeek();
    dragEdge("end", 3); // less than half a 15-minute step
    fireEvent.pointerUp(window);
    expect(props.onResizeEvent).not.toHaveBeenCalled();
  });

  it("cancels with Escape and restores the original size", () => {
    const props = renderWeek();
    dragEdge("end", 2 * HOUR_PX);
    expect(block().style.height).toBe(`${4 * HOUR_PX}px`);

    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(window);

    expect(props.onResizeEvent).not.toHaveBeenCalled();
    expect(block().style.height).toBe(`${2 * HOUR_PX}px`);
  });

  it("blocks the move-drag while an edge is being resized", () => {
    renderWeek();
    dragEdge("end", HOUR_PX);
    expect(block().getAttribute("draggable")).toBe("false");
    const dragStart = createEvent.dragStart(block());
    fireEvent(block(), dragStart);
    expect(dragStart.defaultPrevented).toBe(true);
  });

  it("only offers handles on edges that belong to the visible day", () => {
    renderWeek([
      {
        ...recording,
        id: "late",
        title: "Late stream",
        startAt: new Date(2026, 2, 3, 22, 0).toISOString(), // Tue 22:00
        endAt: new Date(2026, 2, 4, 2, 0).toISOString(), // → Wed 02:00
      },
    ]);
    const tuesday = screen.getByTestId("planner-day-1");
    const wednesdayCol = screen.getByTestId("planner-day-2");

    expect(within(tuesday).queryByTestId("resize-start-late")).toBeTruthy();
    expect(within(tuesday).queryByTestId("resize-end-late")).toBeNull();
    expect(within(wednesdayCol).queryByTestId("resize-start-late")).toBeNull();
    expect(within(wednesdayCol).queryByTestId("resize-end-late")).toBeTruthy();
  });

  it("ignores right-clicks on the handles", () => {
    const props = renderWeek();
    fireEvent.pointerDown(screen.getByTestId("resize-end-rec"), {
      button: 2,
      clientY: 500,
    });
    fireEvent.pointerMove(window, { clientY: 600 });
    fireEvent.pointerUp(window);
    expect(props.onResizeEvent).not.toHaveBeenCalled();
  });
});

// ─── Hover tooltip with the session description ──────────────────────

describe("event tooltip", () => {
  const withNotes: ContentEvent = {
    ...recording,
    notes: "Bring the shotgun mic\nFilm B-roll of the desk",
    project: { id: "p1", title: "Launch video", platform: "youtube-long" },
    projectId: "p1",
  };

  function renderWeekWith(event: ContentEvent) {
    render(
      <WeekView
        cursor={wednesday}
        events={[event]}
        focusedProjectId={null}
        onSelectEvent={vi.fn()}
        onCreateAt={vi.fn()}
        onMoveEvent={vi.fn()}
        onResizeEvent={vi.fn()}
      />,
    );
    return screen.getByRole("button", { name: /Record intro/ });
  }

  it("shows the description and details when hovering a session", async () => {
    const block = renderWeekWith(withNotes);
    fireEvent.mouseEnter(block);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Bring the shotgun mic");
    expect(tooltip.textContent).toContain("Film B-roll of the desk");
    expect(tooltip.textContent).toContain("Recording · Planned");
    expect(tooltip.textContent).toContain("Launch video");
    expect(tooltip.textContent).toMatch(/10:00\sAM – 12:00\sPM/);
    expect(block.getAttribute("aria-describedby")).toBe(tooltip.id);

    fireEvent.mouseLeave(block);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("waits a moment before appearing, so sweeping the mouse doesn't flicker", async () => {
    vi.useFakeTimers();
    try {
      const block = renderWeekWith(withNotes);
      fireEvent.mouseEnter(block);
      expect(screen.queryByRole("tooltip")).toBeNull();
      fireEvent.mouseLeave(block);
      await vi.advanceTimersByTimeAsync(1000);
      expect(screen.queryByRole("tooltip")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so when a session has no description", async () => {
    fireEvent.mouseEnter(renderWeekWith({ ...recording, notes: "   " }));
    expect((await screen.findByRole("tooltip")).textContent).toContain(
      "No description",
    );
  });

  it("opens immediately on keyboard focus and closes on blur", () => {
    const block = renderWeekWith(withNotes);
    fireEvent.focus(block);
    expect(screen.getByRole("tooltip")).toBeTruthy();
    fireEvent.blur(block);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("hides when a resize starts", () => {
    const block = renderWeekWith(withNotes);
    fireEvent.focus(block);
    fireEvent.pointerDown(screen.getByTestId("resize-end-rec"), {
      button: 0,
      clientY: 0,
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerUp(window);
  });

  it("uses the custom type name", () => {
    const block = renderWeekWith({
      ...withNotes,
      type: "OTHER",
      customTypeId: "t1",
      customType: { id: "t1", name: "Podcast", color: "orange" },
    });
    fireEvent.focus(block);
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Podcast · Planned",
    );
  });

  it("works in the month and agenda views too", () => {
    const { unmount } = render(
      <MonthView
        cursor={wednesday}
        events={[withNotes]}
        focusedProjectId={null}
        onSelectEvent={vi.fn()}
        onCreateOnDay={vi.fn()}
        onShowDay={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole("button", { name: /Record intro/ }));
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Bring the shotgun mic",
    );
    unmount();

    render(
      <AgendaView
        events={[withNotes]}
        focusedProjectId={null}
        onSelectEvent={vi.fn()}
        onToggleDone={vi.fn()}
        onPlanVideo={vi.fn()}
      />,
    );
    fireEvent.focus(screen.getByRole("button", { name: /Record intro/ }));
    expect(screen.getByRole("tooltip").textContent).toContain(
      "Bring the shotgun mic",
    );
  });

  it("is placed beside the session and kept inside the screen", () => {
    const viewport = { width: 1200, height: 800 };
    // Room on the right → right of the block.
    expect(place({ top: 100, left: 300, right: 400 }, 200, viewport)).toEqual({
      top: 100,
      left: 408,
    });
    // Near the right edge → flips to the left.
    expect(place({ top: 100, left: 1000, right: 1100 }, 200, viewport)).toEqual(
      {
        top: 100,
        left: 1000 - 8 - 288,
      },
    );
    // Near the bottom → pulled up to fit.
    expect(place({ top: 750, left: 300, right: 400 }, 200, viewport).top).toBe(
      800 - 200 - 8,
    );
  });
});
