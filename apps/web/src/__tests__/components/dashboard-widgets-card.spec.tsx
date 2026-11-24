import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";

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

import api from "@/lib/api";
import { DashboardWidgetsCard } from "@/components/settings/dashboard-widgets-card";
import { useAuthStore } from "@/store/auth.store";
import { useDashboardLayoutStore } from "@/store/dashboard-layout.store";

const apiMock = vi.mocked(api);
const DEFAULTS = DEFAULT_DASHBOARD_WIDGETS.map((w) => ({ ...w }));

function seed(widgets: DashboardWidgetState[] = DEFAULTS, isHydrated = true) {
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

const rows = () =>
  [...document.querySelectorAll("[data-widget-row]")].map((el) =>
    el.getAttribute("data-widget-row"),
  );
const previewed = () =>
  [...document.querySelectorAll("[data-preview-widget]")].map((el) =>
    el.getAttribute("data-preview-widget"),
  );
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

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
  apiMock.delete.mockResolvedValue({});
});

describe("Settings → Dashboard", () => {
  it("lists every widget with its preview, description and a show switch", () => {
    seed();
    render(<DashboardWidgetsCard />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(rows()).toEqual(DEFAULTS.map((w) => w.id));
    for (const id of rows()) {
      expect(
        document.querySelector(
          `[data-widget-row="${id}"] [data-widget-preview]`,
        ),
      ).toBeTruthy();
    }
    expect(
      screen.getByText(
        "Your latest credit movements: tools, purchases and bonuses.",
      ),
    ).toBeTruthy();

    const credits = screen.getByRole("switch", {
      name: "Show Credits on the dashboard",
    });
    expect(credits.getAttribute("aria-checked")).toBe("true");
    // Nothing is hidden in the default layout.
    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("showing a widget updates the preview and saves", async () => {
    seed(
      DEFAULTS.map((w) => (w.id === "credits" ? { ...w, visible: false } : w)),
    );
    render(<DashboardWidgetsCard />);
    expect(previewed()).not.toContain("credits");

    fireEvent.click(
      screen.getByRole("switch", { name: "Show Credits on the dashboard" }),
    );

    expect(previewed()).toContain("credits");
    await flush();
    expect(apiMock.put).toHaveBeenCalledWith("/user/dashboard-layout", {
      widgets: expect.arrayContaining([{ id: "credits", visible: true }]),
    });
  });

  it("moves widgets up and down (no dragging needed) and announces it", async () => {
    seed();
    render(<DashboardWidgetsCard />);

    expect(
      (
        screen.getByRole("button", {
          name: "Move Quick prompt up",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Move Pro tip down",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "Move Recent activity up" }),
    );

    expect(rows().slice(0, 6)).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "activity",
      "asset-stats",
    ]);
    expect(previewed().slice(0, 6)).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "activity",
      "asset-stats",
    ]);
    expect(
      screen.getByText("Recent activity moved to position 5."),
    ).toBeTruthy();
    await flush();
    expect(apiMock.put).toHaveBeenCalledTimes(1);
  });

  it("previews the layout on a desktop or a phone", () => {
    seed();
    render(<DashboardWidgetsCard />);
    const figure = screen.getByRole("figure", {
      name: "Preview of your dashboard",
    });
    // jsdom has no desktop viewport: phone first (mobile-first).
    expect(figure.getAttribute("data-device")).toBe("phone");

    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));

    expect(figure.getAttribute("data-device")).toBe("desktop");
    expect(
      screen
        .getByRole("button", { name: "Desktop" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    // Full-width widgets span both columns of the desktop preview.
    expect(
      document.querySelector('[data-preview-widget="favorites"]')!.className,
    ).toContain("col-span-2");
  });

  it("resets to the default layout", async () => {
    const custom = [...DEFAULTS].reverse();
    seed(custom);
    render(<DashboardWidgetsCard />);

    const reset = screen.getByRole("button", { name: "Reset to default" });
    await act(async () => {
      fireEvent.click(reset);
    });

    expect(apiMock.delete).toHaveBeenCalledWith("/user/dashboard-layout");
    expect(rows()).toEqual(DEFAULTS.map((w) => w.id));
    expect(toastMock.success).toHaveBeenCalledWith(
      "Dashboard reset to default",
    );
    expect((reset as HTMLButtonElement).disabled).toBe(true);
  });

  it("can't change anything until the user's layout has loaded", () => {
    seed(DEFAULTS, false);
    render(<DashboardWidgetsCard />);

    for (const control of [
      ...screen.getAllByRole("switch"),
      screen.getByRole("button", { name: "Move Recent activity up" }),
    ]) {
      expect(
        (control as HTMLButtonElement).disabled ||
          control.getAttribute("data-disabled") !== null,
      ).toBe(true);
    }
  });

  it("is the #dashboard anchor that 'Add widgets' links to", () => {
    seed();
    render(<DashboardWidgetsCard />);
    expect(document.getElementById("dashboard")).toBeTruthy();
  });
});
