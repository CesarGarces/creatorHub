import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { ToolManifest } from "@creator-hub/shared-types";

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
import { renderWithProviders } from "../test-utils";
import { routerMock } from "../mocks/next-navigation";
import { FavoritesWidget } from "@/components/dashboard-widgets/widgets/favorites-widget";
import { ActivityWidget } from "@/components/dashboard-widgets/widgets/activity-widget";
import { CreditsWidget } from "@/components/dashboard-widgets/widgets/credits-widget";
import { RecommendationsWidget } from "@/components/dashboard-widgets/widgets/recommendations-widget";
import { QuickPromptWidget } from "@/components/dashboard-widgets/widgets/quick-prompt-widget";
import { TipsWidget } from "@/components/dashboard-widgets/widgets/tips-widget";
import { TodayPlansWidget } from "@/components/dashboard-widgets/widgets/today-plans-widget";
import { AssetStatsWidget } from "@/components/dashboard-widgets/widgets/asset-stats-widget";
import type { ContentEvent } from "@/lib/content-planner/types";
import { useAuthStore } from "@/store/auth.store";
import enTips from "@/content/pro-tips/en.json";
import esTips from "@/content/pro-tips/es.json";
import {
  localHour,
  parseProTips,
  tipIndexForHour,
} from "@/lib/dashboard-widgets/pro-tips";
import { useToolsStore } from "@/store/tools.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useCreditsStore } from "@/store/credits.store";
import { useChatStore } from "@/store/chat.store";

const apiMock = vi.mocked(api);

const tool = (id: string, name: string): ToolManifest =>
  ({
    id,
    name,
    description: `${name} description`,
    icon: "🧪",
    category: "other",
    creditsPerUse: 1,
    status: "active",
  }) as ToolManifest;

const TOOLS = [
  tool("thumbnail-generator", "Thumbnail Generator"),
  tool("video-generator", "Video Generator"),
  tool("content-translator", "Content Translator"),
  tool("script-writer", "Script Writer"),
  tool("video-clipper", "Video Clipper"),
];

/** Answers GET requests by path. */
function apiGet(routes: Record<string, unknown>) {
  apiMock.get.mockImplementation(((path: string) =>
    Promise.resolve(routes[path] ?? [])) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  useToolsStore.setState(useToolsStore.getInitialState(), true);
  useFavoritesStore.setState(useFavoritesStore.getInitialState(), true);
});

describe("FavoritesWidget", () => {
  it("without favorites: quick access to the first four tools", async () => {
    apiGet({ "/tools": TOOLS, "/user/favorites": [] });
    renderWithProviders(<FavoritesWidget />);

    expect(await screen.findByText("Quick Access")).toBeTruthy();
    expect(screen.getAllByText(/ description$/)).toHaveLength(4);
    expect(
      screen.queryByRole("button", { name: /Drag to reorder/ }),
    ).toBeNull();
  });

  it("with favorites: those tools, in order, each with a drag handle that never lifts the widget", async () => {
    apiGet({
      "/tools": TOOLS,
      "/user/favorites": ["video-clipper", "thumbnail-generator"],
    });
    renderWithProviders(<FavoritesWidget />);

    expect(
      await screen.findByText("Favorite Tools — drag to reorder"),
    ).toBeTruthy();
    const handles = screen.getAllByRole("button", { name: /Drag to reorder/ });
    expect(handles.map((h) => h.getAttribute("aria-label"))).toEqual([
      "Drag to reorder Video Clipper",
      "Drag to reorder Thumbnail Generator",
    ]);
    for (const handle of handles) {
      expect(handle.hasAttribute("data-no-widget-drag")).toBe(true);
      expect(handle.className).toContain("touch-none");
    }
  });

  it("opens a tool", async () => {
    apiGet({ "/tools": TOOLS, "/user/favorites": [] });
    renderWithProviders(<FavoritesWidget />);

    fireEvent.click(await screen.findByText("Thumbnail Generator description"));
    expect(routerMock.push).toHaveBeenCalledWith("/tools/thumbnail-generator");
  });
});

describe("ActivityWidget", () => {
  it("lists the latest movements, with a link to the full history", async () => {
    apiGet({
      "/credits/transactions": [
        {
          id: "t1",
          amount: -5,
          type: "USAGE",
          description: "Thumbnail generation",
          toolName: "Thumbnail Generator",
          toolIcon: "🎨",
          createdAt: new Date().toISOString(),
        },
        {
          id: "t2",
          amount: 500,
          type: "PURCHASE",
          description: "Credits purchase",
          toolName: null,
          toolIcon: null,
          referenceId: "mp-1",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    renderWithProviders(<ActivityWidget />);

    expect(await screen.findByText("Thumbnail generation")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /^View all/ }).getAttribute("href"),
    ).toBe("/history");
  });

  it("says when there is no activity yet", async () => {
    apiGet({ "/credits/transactions": [] });
    renderWithProviders(<ActivityWidget />);
    expect(await screen.findByText("No activity yet")).toBeTruthy();
  });
});

describe("CreditsWidget", () => {
  it("shows the balance and plan, with a link to buy credits", () => {
    useCreditsStore.setState({
      balance: 1500,
      plan: "STARTER",
      isHydrated: true,
    });
    renderWithProviders(<CreditsWidget />);

    expect(screen.getByText("1,500")).toBeTruthy();
    expect(screen.getByText("credits available")).toBeTruthy();
    expect(screen.getByText(/^Plan: /)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Buy credits" }).getAttribute("href"),
    ).toBe("/credits");
    expect(screen.queryByText(/Running low/)).toBeNull();
  });

  it("suggests topping up when the balance runs low", () => {
    useCreditsStore.setState({ balance: 12, plan: "FREE", isHydrated: true });
    renderWithProviders(<CreditsWidget />);
    expect(screen.getByText(/Running low/)).toBeTruthy();
  });

  it("loads the balance if nothing did yet", async () => {
    useCreditsStore.setState({ isHydrated: false });
    apiGet({
      "/credits/balance": {
        balance: 80,
        currentCredits: 80,
        purchasedCredits: 0,
        plan: "FREE",
      },
    });
    renderWithProviders(<CreditsWidget />);
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith("/credits/balance"),
    );
  });
});

describe("RecommendationsWidget", () => {
  it("recommends agents as real links (keyboard reachable)", () => {
    renderWithProviders(<RecommendationsWidget />);

    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/tools/x-post-tweet",
      "/tools/x-search-trends",
    ]);
    expect(screen.getByText("Recommended Agents")).toBeTruthy();
  });
});

describe("QuickPromptWidget", () => {
  it("sends the prompt to the assistant", () => {
    const sendMessage = vi.fn();
    const openWidget = vi.fn();
    useChatStore.setState({ sendMessage, openWidget, isStreaming: false });
    renderWithProviders(<QuickPromptWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Viral video title" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(openWidget).toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith("Viral video title");
  });
});

describe("TipsWidget", () => {
  // Tips come from the JSON content; the one shown depends on the hour.
  afterEach(() => vi.useRealTimers());

  const tipOf = (at: Date, locale: "en" | "es" = "en") => {
    const tips = parseProTips(locale === "en" ? enTips : esTips);
    return tips[tipIndexForHour(localHour(at), tips.length, "u1")]!;
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: { id: "u1", email: "ana@creator.com", role: "USER", name: "Ana" },
    });
  });

  it("shows the tip of the hour, with its category and position", async () => {
    const at = new Date(2026, 10, 17, 10, 15);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(at);
    const tip = tipOf(at);
    renderWithProviders(<TipsWidget />);

    expect(await screen.findByText(tip.title)).toBeTruthy();
    expect(screen.getByText(tip.body)).toBeTruthy();
    expect(
      document.querySelector("[data-tip-id]")!.getAttribute("data-tip-id"),
    ).toBe(tip.id);
    expect(screen.getByText(/^Tip \d+ of 100$/)).toBeTruthy();
    expect(screen.getByText("A new tip every hour.")).toBeTruthy();
  });

  it("changes to another tip when the hour changes", async () => {
    const at = new Date(2026, 10, 17, 10, 59, 30);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(at);
    const first = tipOf(at);
    const next = tipOf(new Date(2026, 10, 17, 11, 0));
    expect(next.id).not.toBe(first.id);
    renderWithProviders(<TipsWidget />);
    expect(await screen.findByText(first.title)).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(31_000); // 11:00:00
    });

    expect(await screen.findByText(next.title)).toBeTruthy();
    expect(screen.queryByText(first.title)).toBeNull();
  });
});

describe("TodayPlansWidget", () => {
  /** Local time on the user's clock. */
  const at = (day: number, hour: number, minute = 0) =>
    new Date(2026, 10, day, hour, minute);
  const NOW = at(17, 10, 30);
  const session = (
    id: string,
    title: string,
    start: Date,
    end: Date,
    extra: Partial<ContentEvent> = {},
  ): ContentEvent => ({
    id,
    projectId: null,
    title,
    type: "RECORDING",
    status: "PLANNED",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    notes: null,
    ...extra,
  });
  const events = (list: ContentEvent[]) =>
    apiGet({ "/tools/content-planner/events": { data: list } });
  const names = () =>
    [...document.querySelectorAll("[data-plan-id]")].map(
      (el) => el.querySelector(".font-medium")?.textContent,
    );

  beforeEach(() => {
    // Only the date: React Query's timers stay real.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("shows the session closest to now first", async () => {
    events([
      session("e1", "Morning script", at(17, 8), at(17, 9)), // 1 h 30 ago
      session("e2", "Edit the vlog", at(17, 15), at(17, 16)), // in 4 h 30
      session("e3", "Record the unboxing", at(17, 11), at(17, 12)), // in 30 min
      session("e4", "Team call", at(17, 10), at(17, 11)), // now
    ]);
    renderWithProviders(<TodayPlansWidget />);
    await screen.findByText("Record the unboxing");

    expect(names()).toEqual([
      "Team call",
      "Record the unboxing",
      "Morning script",
      "Edit the vlog",
    ]);
  });

  it("lists today's sessions, each with its name and description", async () => {
    events([
      session("e2", "Edit the vlog", at(17, 15), at(17, 16, 30), {
        type: "EDITING",
        notes: "Cut the intro under 10 s",
      }),
      session("e1", "Record the unboxing", at(17, 10), at(17, 12), {
        notes: "Two cameras, natural light",
      }),
      session("e0", "Cancelled call", at(17, 9), at(17, 9, 30), {
        status: "CANCELLED",
      }),
    ]);
    renderWithProviders(<TodayPlansWidget />);

    expect(await screen.findByText("Record the unboxing")).toBeTruthy();
    expect(names()).toEqual(["Record the unboxing", "Edit the vlog"]);
    expect(screen.getByText("Two cameras, natural light")).toBeTruthy();
    expect(screen.getByText("Cut the intro under 10 s")).toBeTruthy();
    expect(screen.queryByText("Cancelled call")).toBeNull();
    expect(screen.getByText("Plans for today")).toBeTruthy();
    // The local day, midnight to midnight.
    expect(apiMock.get).toHaveBeenCalledWith("/tools/content-planner/events", {
      params: {
        from: at(17, 0).toISOString(),
        to: at(18, 0).toISOString(),
      },
    });
  });

  it("shows on the right how long until each session starts", async () => {
    events([
      session("e1", "Record the unboxing", at(17, 11), at(17, 12)),
      session("e2", "Edit the vlog", at(17, 16), at(17, 17)),
      session("e3", "Post the teaser", at(17, 12, 30), at(17, 13)),
    ]);
    renderWithProviders(<TodayPlansWidget />);
    await screen.findByText("Record the unboxing");

    const countdown = (id: string) =>
      document.querySelector(`[data-plan-id="${id}"] [data-countdown]`)!
        .textContent;
    expect(countdown("e1")).toBe("in 30 min");
    expect(countdown("e3")).toBe("in 2 h");
    expect(countdown("e2")).toBe("in 5 h 30 min");
  });

  it("shows a past session in red with how long ago it passed", async () => {
    events([
      session("e1", "Morning script", at(17, 8), at(17, 9)),
      session("e2", "Coffee chat", at(17, 9), at(17, 10), { status: "DONE" }),
      session("e3", "Record", at(17, 11), at(17, 12)),
    ]);
    renderWithProviders(<TodayPlansWidget />);
    await screen.findByText("Morning script");

    const missed = document.querySelector('[data-plan-id="e1"]')!;
    expect(missed.getAttribute("data-phase")).toBe("past");
    expect(missed.hasAttribute("data-overdue")).toBe(true);
    expect(missed.querySelector("a")!.className).toContain("bg-error/5");
    const label = missed.querySelector("[data-countdown]")!;
    expect(label.textContent).toBe("1 h 30 min ago");
    expect(label.className).toContain("text-error");
    // Done on time: not red.
    const done = document.querySelector('[data-plan-id="e2"]')!;
    expect(done.hasAttribute("data-overdue")).toBe(false);
    expect(done.querySelector("[data-countdown]")!.textContent).toBe(
      "30 min ago",
    );
    expect(
      document
        .querySelector('[data-plan-id="e3"]')!
        .hasAttribute("data-overdue"),
    ).toBe(false);
  });

  it("marks the session happening now and the ones already done", async () => {
    events([
      session("e1", "Write the script", at(17, 8), at(17, 9), {
        status: "DONE",
      }),
      session("e2", "Record the unboxing", at(17, 10), at(17, 12)),
    ]);
    renderWithProviders(<TodayPlansWidget />);

    const recording = (await screen.findByText("Record the unboxing")).closest(
      "a",
    )!;
    expect(recording.textContent).toContain("Now");
    const script = screen.getByText("Write the script").closest("a")!;
    expect(script.textContent).toContain("Done");
    expect(script.className).toContain("grayscale");
  });

  it("without notes, describes a session by its video; opens it in the planner", async () => {
    events([
      session("e1", "Thumbnail", at(17, 14), at(17, 15), {
        type: "THUMBNAIL",
        project: { id: "p1", title: "Unboxing video", platform: null },
      }),
    ]);
    renderWithProviders(<TodayPlansWidget />);

    const link = (await screen.findByText("Thumbnail")).closest("a")!;
    expect(link.textContent).toContain("Unboxing video");
    expect(link.getAttribute("href")).toBe(
      `/tools/content-planner?date=${encodeURIComponent(at(17, 14).toISOString())}`,
    );
    expect(
      screen.getByRole("link", { name: "Open planner" }).getAttribute("href"),
    ).toMatch(/^\/tools\/content-planner\?date=/);
  });

  it("shows at most five and links to the rest", async () => {
    events(
      Array.from({ length: 7 }, (_, i) =>
        session(`e${i}`, `Session ${i}`, at(17, 11 + i), at(17, 12 + i)),
      ),
    );
    renderWithProviders(<TodayPlansWidget />);

    expect(await screen.findByText("Session 0")).toBeTruthy();
    expect(names()).toHaveLength(5);
    expect(screen.getByRole("link", { name: "+2 more sessions" })).toBeTruthy();
  });

  it("says when nothing is planned, with a way to plan", async () => {
    events([]);
    renderWithProviders(<TodayPlansWidget />);

    expect(await screen.findByText("Nothing planned for today.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Plan a session" })).toBeTruthy();
  });

  it("offers a retry when today's plans can't be loaded", async () => {
    apiMock.get.mockRejectedValueOnce(new Error("offline"));
    renderWithProviders(<TodayPlansWidget />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
  });
});

describe("AssetStatsWidget", () => {
  const ENGAGEMENT = {
    totals: { likes: 1280, views: 45210, assets: 14, publicAssets: 3 },
    top: [
      {
        id: "img1",
        type: "IMAGE",
        title: "Neon gaming thumbnail",
        previewUrl: "https://signed/img1.png",
        likeCount: 1200,
        viewCount: 38000,
        isPublic: true,
        createdAt: "2026-11-10T12:00:00.000Z",
      },
      {
        id: "vid1",
        type: "VIDEO",
        title: "Launch teaser",
        previewUrl: "https://signed/vid1-thumb.jpg",
        likeCount: 60,
        viewCount: 7000,
        isPublic: true,
        createdAt: "2026-11-09T12:00:00.000Z",
      },
      {
        id: "vid2",
        type: "VIDEO",
        title: "Old clip",
        previewUrl: null,
        likeCount: 0,
        viewCount: 12,
        isPublic: false,
        createdAt: "2026-11-01T12:00:00.000Z",
      },
    ],
  };
  const engagement = (body: unknown) =>
    apiGet({ "/user/assets/engagement": body });
  const tile = (id: string) =>
    document.querySelector<HTMLElement>(`[data-asset-id="${id}"]`)!;

  it("shows the total likes and views", async () => {
    engagement(ENGAGEMENT);
    renderWithProviders(<AssetStatsWidget />);

    expect(await screen.findByText("1,280")).toBeTruthy();
    expect(screen.getByText("45,210")).toBeTruthy();
    expect(screen.getByText("Total likes")).toBeTruthy();
    expect(screen.getByText("Total views")).toBeTruthy();
    expect(apiMock.get).toHaveBeenCalledWith("/user/assets/engagement", {
      params: { limit: "4" },
    });
  });

  it("previews each asset with a still image and its likes and views", async () => {
    engagement(ENGAGEMENT);
    renderWithProviders(<AssetStatsWidget />);
    await screen.findByText("Neon gaming thumbnail");

    const image = tile("img1");
    expect(image.querySelector("img")!.getAttribute("src")).toBe(
      "https://signed/img1.png",
    );
    expect(image.querySelector("img")!.getAttribute("loading")).toBe("lazy");
    // Compact on screen, in full for screen readers.
    expect(image.textContent).toContain("1.2K");
    expect(image.textContent).toContain("38K");
    expect(image.textContent).toContain("1,200 likes");
    expect(image.textContent).toContain("38,000 views");
  });

  it("shows a video as its thumbnail, marked as a video — never plays it", async () => {
    engagement(ENGAGEMENT);
    renderWithProviders(<AssetStatsWidget />);
    await screen.findByText("Launch teaser");

    expect(document.querySelector("video")).toBeNull();
    const teaser = tile("vid1");
    expect(teaser.querySelector("img")!.getAttribute("src")).toBe(
      "https://signed/vid1-thumb.jpg",
    );
    expect(teaser.textContent).toContain("Video");
    // No thumbnail: a placeholder instead.
    const old = tile("vid2");
    expect(old.querySelector("img")).toBeNull();
    expect(
      old.querySelector('[data-preview="none"]')!.getAttribute("title"),
    ).toBe("No preview");
  });

  it("a preview that fails to load becomes the placeholder", async () => {
    engagement(ENGAGEMENT);
    renderWithProviders(<AssetStatsWidget />);
    await screen.findByText("Neon gaming thumbnail");

    fireEvent.error(tile("img1").querySelector("img")!);
    expect(tile("img1").querySelector("img")).toBeNull();
    expect(tile("img1").querySelector('[data-preview="none"]')).toBeTruthy();
  });

  it("opens a shared asset's public page in a new tab (the dashboard stays)", async () => {
    engagement(ENGAGEMENT);
    renderWithProviders(<AssetStatsWidget />);
    await screen.findByText("Launch teaser");

    const shared = tile("vid1").querySelector("a")!;
    expect(shared.getAttribute("href")).toBe("/share/vid1");
    expect(shared.getAttribute("target")).toBe("_blank");
    expect(shared.getAttribute("rel")).toBe("noopener noreferrer");
    // Said to screen readers, shown as an arrow.
    expect(shared.textContent).toContain("(opens in a new tab)");
  });

  it("opens the Assets page for a private asset, in the same tab", async () => {
    engagement(ENGAGEMENT);
    renderWithProviders(<AssetStatsWidget />);
    await screen.findByText("Old clip");

    const own = tile("vid2").querySelector("a")!;
    expect(own.getAttribute("href")).toBe("/assets");
    expect(own.hasAttribute("target")).toBe(false);
    expect(own.textContent).not.toContain("new tab");
  });

  it("without likes or views yet, suggests sharing", async () => {
    engagement({
      totals: { likes: 0, views: 0, assets: 2, publicAssets: 0 },
      top: [],
    });
    renderWithProviders(<AssetStatsWidget />);

    expect(await screen.findByText(/No likes or views yet/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Go to my assets" })
        .getAttribute("href"),
    ).toBe("/assets");
    expect(screen.getAllByText("0")).toHaveLength(2);
  });

  it("offers a retry when the numbers can't be loaded", async () => {
    apiMock.get.mockRejectedValueOnce(new Error("offline"));
    renderWithProviders(<AssetStatsWidget />);

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(2));
  });
});
