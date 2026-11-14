import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

const socketEvents = vi.hoisted(() => ({
  options: null as null | { onNotificationNew?: (n: unknown) => void },
}));

vi.mock("@/hooks/use-socket-events", () => ({
  useSocketEvents: (options: NonNullable<typeof socketEvents.options>) => {
    socketEvents.options = options;
  },
}));
vi.mock("@/components/chat/chat-widget", () => ({
  ChatWidget: () => <div data-testid="chat-widget" />,
}));

import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { CommandPalette } from "@/components/layout/command-palette";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useAuthStore } from "@/store/auth.store";
import { useCreditsStore } from "@/store/credits.store";
import {
  useNotificationStore,
  type Notification,
} from "@/store/notification.store";
import { navigationState, routerMock } from "../mocks/next-navigation";

const user = {
  id: "u1",
  email: "ana@creator.com",
  role: "USER",
  name: "Ana Creator",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user, logout: vi.fn() });
});

describe("Sidebar", () => {
  it("groups navigation into sections", () => {
    render(<Sidebar />);

    for (const section of ["Dashboard", "Workspace", "Community", "Account"]) {
      expect(screen.getAllByText(section).length).toBeGreaterThan(0);
    }
    expect(
      screen.getByText("Community Bot").closest("a")!.getAttribute("href"),
    ).toBe("/community-bot");
  });

  it("highlights the active route, including nested pages", () => {
    navigationState.pathname = "/tools/thumbnail-generator";
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: "Tools" }).className).toContain(
      "text-primary",
    );
    expect(
      screen.getByRole("link", { name: "Dashboard" }).className,
    ).not.toContain("text-primary");
  });

  it("does not treat a route prefix as active", () => {
    navigationState.pathname = "/toolsettings";
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Tools" }).className).not.toContain(
      "text-primary",
    );
  });

  it("shows the current user and logs out", () => {
    render(<Sidebar />);

    expect(screen.getByText("Ana Creator")).toBeTruthy();
    expect(screen.getByText("ana@creator.com")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Logout"));

    expect(useAuthStore.getState().logout).toHaveBeenCalled();
    expect(routerMock.push).toHaveBeenCalledWith("/login");
  });

  it("falls back to the email handle when the user has no name", () => {
    useAuthStore.setState({ user: { ...user, name: undefined } });
    render(<Sidebar />);
    expect(screen.getByText("ana")).toBeTruthy();
  });

  it("collapses to icons only", () => {
    const { container } = render(<Sidebar />);
    const toggle = container.querySelector(
      "aside > div button",
    ) as HTMLButtonElement;

    fireEvent.click(toggle);

    expect(container.querySelector("aside")!.className).toContain("w-16");
    expect(screen.queryByTitle("Logout")).toBeNull();
    expect(screen.queryByText("DASHBOARD")).toBeNull();
  });
});

describe("TopBar", () => {
  const notificationActions = {
    fetchNotifications: vi.fn(),
    fetchUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    addNotification: vi.fn(),
  };

  function notification(overrides: Partial<Notification> = {}): Notification {
    return {
      id: "n1",
      userId: "u1",
      type: "GENERATION_COMPLETE",
      title: "Your thumbnail is ready",
      body: null,
      data: null,
      readAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  function renderTopBar(props: Parameters<typeof TopBar>[0] = {}) {
    render(<TopBar {...props} />);
  }

  /** Opens the notifications popover (the bell is the first header button). */
  function openNotifications() {
    fireEvent.click(screen.getByRole("button", { name: "Open notifications" }));
    expect(screen.getByText("Notifications")).toBeTruthy();
  }

  beforeEach(() => {
    useCreditsStore.setState({
      balance: 500,
      isLoading: false,
      isHydrated: true,
    });
    useNotificationStore.setState({
      ...useNotificationStore.getInitialState(),
      ...notificationActions,
    });
  });

  it("renders breadcrumbs with links for all but the current page", () => {
    renderTopBar({
      breadcrumbs: [
        { label: "Tools", href: "/tools" },
        { label: "Thumbnails" },
      ],
    });

    expect(screen.getByText("Tools").closest("a")!.getAttribute("href")).toBe(
      "/tools",
    );
    expect(screen.getByText("Thumbnails").closest("a")).toBeNull();
  });

  it("renders a title when there are no breadcrumbs", () => {
    renderTopBar({
      title: "Dashboard",
      actions: <button type="button">Action</button>,
    });

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText("Action")).toBeTruthy();
  });

  it("shows the credit balance", () => {
    renderTopBar();
    expect(screen.getByText("500 credits")).toBeTruthy();
  });

  it("loads notifications once for a signed-in user", () => {
    renderTopBar();

    expect(notificationActions.fetchNotifications).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(notificationActions.fetchUnreadCount).toHaveBeenCalled();
  });

  it("does not load notifications when already hydrated or signed out", () => {
    useNotificationStore.setState({ isHydrated: true });
    renderTopBar();
    useAuthStore.setState({ user: null });
    useNotificationStore.setState({ isHydrated: false });
    renderTopBar();

    expect(notificationActions.fetchNotifications).not.toHaveBeenCalled();
  });

  it("adds real-time notifications from the socket", () => {
    renderTopBar();
    const incoming = notification({ id: "live" });

    socketEvents.options!.onNotificationNew!(incoming);

    expect(notificationActions.addNotification).toHaveBeenCalledWith(incoming);
  });

  it.each([
    [3, "3"],
    [150, "99+"],
  ])("shows an unread badge for %i notifications", (count, label) => {
    useNotificationStore.setState({ unreadCount: count });
    renderTopBar();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("lists notifications and lets the user mark and delete them", async () => {
    useNotificationStore.setState({
      unreadCount: 1,
      notifications: [
        notification({ id: "n1", body: "Video finished rendering" }),
        notification({
          id: "n2",
          title: "Old news",
          readAt: "2026-01-01T00:00:00Z",
        }),
      ],
    });
    renderTopBar();
    openNotifications();

    expect(screen.getByText("Video finished rendering")).toBeTruthy();
    // Already-read notifications cannot be marked read again.
    expect(screen.getAllByTitle("Mark as read")).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByTitle("Mark as read"));
      fireEvent.click(screen.getAllByTitle("Delete")[1]!);
      fireEvent.click(screen.getByText("Mark all read"));
    });

    expect(notificationActions.markAsRead).toHaveBeenCalledWith("n1");
    expect(notificationActions.deleteNotification).toHaveBeenCalledWith("n2");
    expect(notificationActions.markAllAsRead).toHaveBeenCalled();
  });

  it("shows an empty state", () => {
    renderTopBar();
    openNotifications();
    expect(screen.getByText("No notifications")).toBeTruthy();
  });

  describe("low-credit warning", () => {
    it("adds a buy-credits notice below 50 credits", () => {
      useCreditsStore.setState({ balance: 20 });
      renderTopBar();
      openNotifications();

      expect(
        screen.getByText(
          "You have 20 credits remaining. Buy more to keep generating.",
        ),
      ).toBeTruthy();
      fireEvent.click(screen.getByText("Buy Credits →"));
      expect(routerMock.push).toHaveBeenCalledWith("/credits");
    });

    it("uses a dedicated message at zero credits and cannot be dismissed", () => {
      useCreditsStore.setState({ balance: 0 });
      renderTopBar();
      openNotifications();

      const notice = screen.getByText(
        "You have no credits left. Buy more to keep generating.",
      );
      const row = notice.closest("div.p-3") as HTMLElement;
      expect(within(row).queryByTitle("Delete")).toBeNull();
      expect(within(row).queryByTitle("Mark as read")).toBeNull();
    });

    it("is not shown before the balance has loaded", () => {
      useCreditsStore.setState({ balance: 0, isHydrated: false });
      renderTopBar();
      openNotifications();
      expect(screen.getByText("No notifications")).toBeTruthy();
    });
  });
});

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    render(<CommandPalette isOpen={false} onClose={vi.fn()} />);
    expect(
      screen.queryByPlaceholderText("Search tools, agents, pages..."),
    ).toBeNull();
  });

  it("groups the default commands by category", () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    for (const heading of ["Tools", "Agents", "Navigation", "Account"]) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    expect(screen.getByText("Thumbnail Generator")).toBeTruthy();
  });

  it("navigates to the selected page and closes", () => {
    const onClose = vi.fn();
    render(<CommandPalette isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText("Credits"));

    expect(routerMock.push).toHaveBeenCalledWith("/credits");
    expect(onClose).toHaveBeenCalled();
  });

  it("runs custom actions instead of navigating", () => {
    const action = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        items={[{ id: "x", label: "Toggle theme", action, href: "/ignored" }]}
      />,
    );

    expect(screen.getByText("Other")).toBeTruthy();
    fireEvent.click(screen.getByText("Toggle theme"));

    expect(action).toHaveBeenCalled();
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("filters commands as the user types", async () => {
    render(<CommandPalette isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.change(
        screen.getByPlaceholderText("Search tools, agents, pages..."),
        {
          target: { value: "zzzz-no-match" },
        },
      );
    });

    expect(screen.getByText("No results found.")).toBeTruthy();
    expect(screen.queryByText("Thumbnail Generator")).toBeNull();
  });
});

describe("DashboardLayout", () => {
  it("renders the sidebar, page content and chat widget", () => {
    render(
      <DashboardLayout>
        <p>page content</p>
      </DashboardLayout>,
    );

    expect(screen.getByRole("main").textContent).toBe("page content");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByTestId("chat-widget")).toBeTruthy();
  });
});
