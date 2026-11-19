import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { DashboardWidgetState } from "@creator-hub/shared-types";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
);
vi.mock("sonner", () => ({ toast: toastMock }));

// Real widgets are covered in their own specs; here each one is a stub with
// a text field and a button (what a long press must or mustn't pick up).
vi.mock("@/components/dashboard-widgets/widget-loader", async () => {
  const { DASHBOARD_WIDGET_IDS } = await import("@creator-hub/shared-types");
  return {
    WIDGET_COMPONENTS: Object.fromEntries(
      DASHBOARD_WIDGET_IDS.map((id) => [
        id,
        () => (
          <div data-testid={`widget-${id}`}>
            <input aria-label={`${id} field`} />
            <button type="button">{`${id} action`}</button>
          </div>
        ),
      ]),
    ),
  };
});

import api from "@/lib/api";
import { DashboardWidgets } from "@/components/dashboard-widgets/widget-grid";
import { useAuthStore } from "@/store/auth.store";
import { useDashboardLayoutStore } from "@/store/dashboard-layout.store";
import { LONG_PRESS_MS } from "@/lib/dashboard-widgets/drag";
import { routerMock } from "../mocks/next-navigation";

const apiMock = vi.mocked(api);

const LAYOUT: DashboardWidgetState[] = [
  { id: "activity", visible: true },
  { id: "quick-prompt", visible: true },
  { id: "favorites", visible: false },
  { id: "recommendations", visible: true },
  { id: "tips", visible: false },
  { id: "credits", visible: false },
  { id: "today-plans", visible: false },
  { id: "asset-stats", visible: false },
  { id: "voice-assistant", visible: false },
];

function seed(widgets = LAYOUT, isHydrated = true) {
  useDashboardLayoutStore.setState({
    widgets,
    saved: widgets,
    isHydrated,
    ownerId: "u1",
  });
  apiMock.get.mockReturnValue(
    (isHydrated
      ? Promise.resolve({ widgets, updatedAt: null })
      : new Promise(() => {})) as never,
  );
}

function renderGrid(editing = false) {
  const onEditingChange = vi.fn();
  const view = render(
    <DashboardWidgets editing={editing} onEditingChange={onEditingChange} />,
  );
  return { ...view, onEditingChange };
}

const cell = (id: string) =>
  document.querySelector<HTMLElement>(`[data-widget-id="${id}"]`)!;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useDashboardLayoutStore.setState(
    useDashboardLayoutStore.getInitialState(),
    true,
  );
  useAuthStore.setState({
    user: { id: "u1", email: "ana@creator.com", role: "USER", name: "Ana" },
  });
  apiMock.put.mockResolvedValue({});
});

afterEach(() => vi.useRealTimers());

describe("DashboardWidgets", () => {
  it("shows the visible widgets in the user's order, and only those", async () => {
    seed();
    renderGrid();

    const shown = [...document.querySelectorAll("[data-widget-id]")].map((el) =>
      el.getAttribute("data-widget-id"),
    );
    expect(shown).toEqual(["activity", "quick-prompt", "recommendations"]);
    expect(await screen.findByTestId("widget-activity")).toBeTruthy();
    expect(screen.queryByTestId("widget-favorites")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Dashboard widgets" }),
    ).toBeTruthy();
  });

  it("full widgets span both desktop columns, half widgets one", () => {
    seed();
    renderGrid();

    expect(cell("quick-prompt").className).toContain("lg:col-span-2");
    expect(cell("activity").className).toContain("lg:col-span-1");
  });

  it("holds placeholders (no widget code or data) until the layout is known", () => {
    seed(LAYOUT, false);
    renderGrid();

    expect(cell("activity")).toBeTruthy();
    expect(screen.queryByTestId("widget-activity")).toBeNull();
  });

  it("offers to add widgets when every widget is hidden", async () => {
    seed(LAYOUT.map((w) => ({ ...w, visible: false })));
    renderGrid();

    expect(screen.getByText("Your dashboard is empty")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add widgets" }));
    expect(routerMock.push).toHaveBeenCalledWith("/settings#dashboard");
  });

  describe("rearranging", () => {
    it("makes the content inert and shows hide/move controls per widget", () => {
      seed();
      renderGrid(true);

      const body = cell("activity").querySelector("[data-widget-body]")!;
      expect(body.hasAttribute("inert")).toBe(true);
      expect(
        screen.getByRole("button", { name: "Hide Recent activity" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Move Recent activity" }),
      ).toBeTruthy();
      expect(screen.getByText(/Drag widgets to rearrange them/)).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Add widgets" }).getAttribute("href"),
      ).toBe("/settings#dashboard");
    });

    it("hides a widget, with Undo", () => {
      seed();
      renderGrid(true);

      fireEvent.click(
        screen.getByRole("button", { name: "Hide Recent activity" }),
      );

      expect(cell("activity")).toBeNull();
      expect(toastMock).toHaveBeenCalledWith(
        "Recent activity hidden",
        expect.objectContaining({
          action: expect.objectContaining({ label: "Undo" }),
        }),
      );
      const { action } = toastMock.mock.calls[0]![1] as {
        action: { onClick: () => void };
      };
      act(() => action.onClick());
      expect(cell("activity")).toBeTruthy();
    });

    it("Done and Escape finish rearranging", () => {
      seed();
      const { onEditingChange } = renderGrid(true);

      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(onEditingChange).toHaveBeenLastCalledWith(false);

      onEditingChange.mockClear();
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onEditingChange).toHaveBeenCalledWith(false);
    });

    it("tells the user when a change couldn't be saved", () => {
      seed();
      renderGrid(true);

      act(() => useDashboardLayoutStore.setState({ saveErrors: 1 }));
      expect(toastMock.error).toHaveBeenCalledWith(
        "Couldn't save your dashboard. Your last change was undone.",
      );
    });
  });

  describe("keyboard", () => {
    // jsdom has no layout: stack the cells 100px apart, in DOM order, so
    // moving to another widget changes coordinates as in a browser.
    beforeEach(() => {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
        function (this: Element) {
          const cells = [...document.querySelectorAll("[data-widget-id]")];
          const top = Math.max(0, cells.indexOf(this)) * 100;
          return {
            x: 0,
            y: top,
            top,
            left: 0,
            width: 300,
            height: 90,
            right: 300,
            bottom: top + 90,
            toJSON: () => ({}),
          } as DOMRect;
        },
      );
    });
    afterEach(() => vi.restoreAllMocks());

    /** dnd-kit starts listening for keys on the next tick after pickup. */
    const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));
    const key = (target: Element | Document, code: string) =>
      act(() => {
        fireEvent.keyDown(target, { code, key: code });
      });

    it("moves a widget one place per arrow key, by its position in the order", async () => {
      seed();
      renderGrid(true);
      const grip = screen.getByRole("button", { name: "Move Recommendations" });
      grip.focus();

      await key(grip, "Space");
      await tick();
      await key(document, "ArrowUp");
      await key(document, "ArrowUp");
      await key(document, "Space");

      // activity, quick-prompt, recommendations → recommendations first.
      expect(
        [...document.querySelectorAll("[data-widget-id]")].map((el) =>
          el.getAttribute("data-widget-id"),
        ),
      ).toEqual(["recommendations", "activity", "quick-prompt"]);
      const saved = useDashboardLayoutStore.getState().widgets;
      expect(saved.filter((w) => w.visible).map((w) => w.id)).toEqual([
        "recommendations",
        "activity",
        "quick-prompt",
      ]);
      // Hidden widgets kept their places.
      expect(saved[2]).toEqual({ id: "favorites", visible: false });
    });

    it("the opposite arrow undoes a move (one swap per key press)", async () => {
      seed();
      renderGrid(true);
      const grip = screen.getByRole("button", { name: "Move Recommendations" });
      grip.focus();
      const shown = () =>
        [...document.querySelectorAll("[data-widget-id]")].map((el) =>
          el.getAttribute("data-widget-id"),
        );

      await key(grip, "Space");
      await tick();
      await key(document, "ArrowUp");
      expect(shown()).toEqual(["activity", "recommendations", "quick-prompt"]);
      await key(document, "ArrowDown");
      expect(shown()).toEqual(["activity", "quick-prompt", "recommendations"]);
      await key(document, "ArrowLeft");
      await key(document, "Space");

      expect(shown()).toEqual(["activity", "recommendations", "quick-prompt"]);
    });

    it("stays put at the ends and Escape cancels the move", async () => {
      seed();
      renderGrid(true);
      const grip = screen.getByRole("button", { name: "Move Recent activity" });
      grip.focus();

      await key(grip, "Space");
      await tick();
      await key(document, "ArrowLeft"); // already first
      await key(document, "ArrowDown");
      await key(document, "Escape");

      expect(
        useDashboardLayoutStore
          .getState()
          .widgets.filter((w) => w.visible)
          .map((w) => w.id),
      ).toEqual(["activity", "quick-prompt", "recommendations"]);
    });
  });

  describe("press and hold", () => {
    const press = (el: Element, x = 10, y = 10) =>
      fireEvent.mouseDown(el, { button: 0, clientX: x, clientY: y });

    it("a long press picks the widget up and starts rearranging", async () => {
      seed();
      const { onEditingChange } = renderGrid();
      const target = await screen.findByRole("button", {
        name: "activity action",
      });
      vi.useFakeTimers();

      press(target);
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 50));
      expect(onEditingChange).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(60));
      expect(onEditingChange).toHaveBeenCalledWith(true);

      act(() => {
        fireEvent.mouseUp(document);
      });
    });

    it("moving first (scrolling, selecting) cancels the long press", async () => {
      seed();
      const { onEditingChange } = renderGrid();
      const target = await screen.findByRole("button", {
        name: "activity action",
      });
      vi.useFakeTimers();

      press(target, 10, 10);
      fireEvent.mouseMove(document, { clientX: 10, clientY: 40 });
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 50));

      expect(onEditingChange).not.toHaveBeenCalled();
      fireEvent.mouseUp(document);
    });

    it("a long press in a text field never picks the widget up", async () => {
      seed();
      const { onEditingChange } = renderGrid();
      const field = await screen.findByRole("textbox", {
        name: "quick-prompt field",
      });
      vi.useFakeTimers();

      press(field);
      act(() => vi.advanceTimersByTime(LONG_PRESS_MS + 50));

      expect(onEditingChange).not.toHaveBeenCalled();
      fireEvent.mouseUp(document);
    });

    it("Space in a widget types (the keyboard only moves widgets while rearranging)", async () => {
      seed();
      const { onEditingChange } = renderGrid();
      const field = await screen.findByRole("textbox", {
        name: "quick-prompt field",
      });

      const event = new KeyboardEvent("keydown", {
        key: " ",
        code: "Space",
        bubbles: true,
        cancelable: true,
      });
      field.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
      expect(onEditingChange).not.toHaveBeenCalled();
    });
  });
});

describe("WidgetSkeleton — quick prompt", () => {
  it("has the widget's geometry: the button's touch height and the examples row", async () => {
    const { WidgetSkeleton } =
      await import("@/components/dashboard-widgets/widget-skeleton");
    const { container } = render(<WidgetSkeleton id="quick-prompt" />);
    // Invisible real texts: they wrap like the widget in every language.
    expect(screen.getByText("Generate").className).toContain(
      "pointer-coarse:min-h-11",
    );
    expect(screen.getByText("Try:")).toBeTruthy();
    expect(container.querySelectorAll(".invisible").length).toBe(2);
  });
});
