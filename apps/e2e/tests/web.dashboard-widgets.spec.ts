import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { mockApi, type MockHandler } from "../fixtures/api-mock";
import { signInWeb, webApiRoutes } from "../fixtures/web-data";
import { expectAccessible } from "../fixtures/a11y";
import {
  VIEWPORTS,
  expectNoHorizontalOverflow,
  expectTouchTarget,
  snap,
} from "../fixtures/responsive";

/**
 * Dashboard widgets (ARCHITECTURE.md §2f): press and hold to rearrange
 * (mouse, finger, keyboard), hide/undo, Settings → Dashboard with its
 * preview, lazy data loading and reduced motion.
 */

type Widget = { id: string; visible: boolean };

const DEFAULT_LAYOUT: Widget[] = [
  { id: "quick-prompt", visible: true },
  { id: "today-plans", visible: true },
  { id: "voice-assistant", visible: true },
  { id: "favorites", visible: true },
  { id: "asset-stats", visible: true },
  { id: "activity", visible: true },
  { id: "recommendations", visible: true },
  { id: "credits", visible: true },
  { id: "tips", visible: true },
];

/** A backend that remembers the layout (survives reloads). */
function layoutBackend(initial: Widget[] = DEFAULT_LAYOUT) {
  let widgets = initial.map((w) => ({ ...w }));
  const routes: Record<string, MockHandler> = {
    "GET /user/dashboard-layout": () => ({ widgets, updatedAt: null }),
    "PUT /user/dashboard-layout": ({ body }) => {
      widgets = (body as { widgets: Widget[] }).widgets;
      return { widgets, updatedAt: new Date().toISOString() };
    },
    "DELETE /user/dashboard-layout": () => {
      widgets = DEFAULT_LAYOUT.map((w) => ({ ...w }));
      return { widgets, updatedAt: null };
    },
  };
  return { routes, current: () => widgets };
}

const cell = (page: Page, id: string) =>
  page.locator(`[data-widget-id="${id}"]`);

const order = (page: Page) =>
  page
    .locator("[data-widget-id]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-widget-id")));

const editBarDone = (page: Page) =>
  page.getByRole("button", { name: "Done", exact: true });

async function openDashboard(page: Page) {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /^Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
  // Above the fold everywhere (widgets further down mount on approach).
  await expect(
    page.getByRole("textbox", { name: "Describe what you want to create" }),
  ).toBeVisible();
}

async function center(page: Page, id: string, dx = 0.5, dy = 0.5) {
  const box = (await cell(page, id).boundingBox())!;
  return { x: box.x + box.width * dx, y: box.y + box.height * dy };
}

test.describe("dashboard widgets · desktop", () => {
  let backend: ReturnType<typeof layoutBackend>;
  let api: Awaited<ReturnType<typeof mockApi>>;

  test.beforeEach(async ({ context, baseURL }) => {
    backend = layoutBackend();
    api = await mockApi(
      context,
      { ...webApiRoutes, ...backend.routes },
      baseURL!,
    );
    await signInWeb(context, baseURL!);
  });

  test("press and hold lifts a widget with a bounce; drop saves the new order", async ({
    page,
  }, testInfo) => {
    await openDashboard(page);
    expect(await order(page)).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "asset-stats",
      "activity",
      "recommendations",
      "credits",
      "tips",
    ]);

    // A short click is a click: no rearranging.
    const start = await center(page, "activity", 0.3, 0.1);
    await page.mouse.click(start.x, start.y);
    await expect(editBarDone(page)).toHaveCount(0);

    // Hold still ~0.4 s: the widget lifts and every widget starts wobbling.
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(editBarDone(page)).toBeVisible();
    const lifted = page.locator("[data-widget-lift]");
    await expect(lifted).toBeVisible();
    expect(
      await lifted.evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("widget-lift");
    expect(
      await cell(page, "tips")
        .locator("[data-widget-wobble]")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("widget-jiggle");

    // Drag it onto the quick prompt: the grid reflows while dragging.
    const target = await center(page, "quick-prompt", 0.25, 0.5);
    await page.mouse.move(target.x, target.y, { steps: 20 });
    await expect
      .poll(() => order(page))
      .toEqual([
        "activity",
        "quick-prompt",
        "today-plans",
        "voice-assistant",
        "favorites",
        "asset-stats",
        "recommendations",
        "credits",
        "tips",
      ]);
    await snap(page, testInfo, "dashboard widget dragging");

    // Release: it lands with a bounce and the order is saved once.
    await page.mouse.up();
    await expect(lifted).toHaveAttribute("data-landing", "");
    await expect(lifted).toHaveCount(0);
    await expect
      .poll(() => api.calls("PUT", "/user/dashboard-layout").length)
      .toBe(1);
    expect(backend.current().map((w) => w.id)).toEqual([
      "activity",
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "asset-stats",
      "recommendations",
      "credits",
      "tips",
    ]);

    // Still rearranging until Done; the order survives a reload.
    await editBarDone(page).click();
    await expect(editBarDone(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Recent Activity")).toBeVisible();
    expect((await order(page))[0]).toBe("activity");
  });

  test("dragging across widgets of different sizes settles (no swap loops)", async ({
    page,
    context,
    baseURL,
  }) => {
    const all = layoutBackend(
      DEFAULT_LAYOUT.map((w) => ({ ...w, visible: true })),
    );
    await mockApi(context, { ...webApiRoutes, ...all.routes }, baseURL!);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && /Maximum update depth/.test(m.text())) {
        errors.push(m.text());
      }
    });
    await openDashboard(page);

    // A half-width widget zig-zags over full- and half-width ones, and
    // hovers with small jitter where a reflow puts another widget under it.
    await cell(page, "tips").scrollIntoViewIfNeeded();
    const start = await center(page, "tips", 0.3, 0.1);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(editBarDone(page)).toBeVisible();
    for (const [id, dx, dy] of [
      ["activity", 0.8, 0.5],
      ["favorites", 0.2, 0.6],
      ["recommendations", 0.5, 0.2],
      ["quick-prompt", 0.9, 0.5],
      ["credits", 0.5, 0.5],
      ["favorites", 0.7, 0.3],
    ] as const) {
      const box = await cell(page, id).boundingBox();
      if (!box) continue;
      const x = box.x + box.width * dx;
      const y = Math.max(70, box.y + box.height * dy);
      await page.mouse.move(x, y, { steps: 8 });
      for (const jitter of [3, -3, 2, -2]) {
        await page.mouse.move(x + jitter, y - jitter);
      }
    }
    await page.mouse.up();
    await expect(page.locator("[data-widget-lift]")).toHaveCount(0);

    expect([...(await order(page))].sort()).toEqual(
      DEFAULT_LAYOUT.map((w) => w.id).sort(),
    );
    expect(errors).toEqual([]);
  });

  test("keyboard: Customize, then move a widget with its grip button", async ({
    page,
  }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Customize dashboard" }).click();
    await expect(editBarDone(page)).toBeVisible();

    // Each step is announced to screen readers; wait for it like a user.
    const announced = (text: string) =>
      expect(
        page.locator("[id^=DndLiveRegion]", { hasText: text }),
      ).toBeAttached();
    const grip = page.getByRole("button", { name: "Move Pro tip" });
    await grip.focus();
    await page.keyboard.press("Space");
    await announced("Picked up Pro tip.");
    // dnd-kit listens for arrows from its next timer tick; timers run in
    // order, so one queued now runs after it.
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    // One place per arrow, by position — whatever the widget sizes.
    await page.keyboard.press("ArrowUp");
    await announced("Pro tip is now at position 8 of 9.");
    await page.keyboard.press("ArrowUp");
    await announced("Pro tip is now at position 7 of 9.");
    // The opposite arrow takes it back; then up again.
    await page.keyboard.press("ArrowDown");
    await announced("Pro tip is now at position 8 of 9.");
    await page.keyboard.press("ArrowLeft");
    await announced("Pro tip is now at position 7 of 9.");
    await page.keyboard.press("Space");
    await announced("Pro tip dropped at position 7 of 9.");

    expect(await order(page)).toEqual([
      "quick-prompt",
      "today-plans",
      "voice-assistant",
      "favorites",
      "asset-stats",
      "activity",
      "tips",
      "recommendations",
      "credits",
    ]);
    await expect
      .poll(() => api.calls("PUT", "/user/dashboard-layout").length)
      .toBe(1);

    await page.keyboard.press("Escape");
    await expect(editBarDone(page)).toHaveCount(0);
  });

  test("hide a widget while rearranging, then undo", async ({ page }) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Customize dashboard" }).click();

    // Widget content can't be used while rearranging.
    await expect(
      cell(page, "activity").locator("[data-widget-body]"),
    ).toHaveAttribute("inert", "");

    await page.getByRole("button", { name: "Hide Recent activity" }).click();
    await expect(cell(page, "activity")).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(cell(page, "activity")).toHaveCount(1);
    await expect
      .poll(() => backend.current().find((w) => w.id === "activity")!.visible)
      .toBe(true);
  });

  test("hidden widgets don't load their code or data", async ({
    page,
    context,
    baseURL,
  }) => {
    const hidden = layoutBackend(
      DEFAULT_LAYOUT.map((w) =>
        w.id === "activity" || w.id === "credits"
          ? { ...w, visible: false }
          : w,
      ),
    );
    const calls = await mockApi(
      context,
      { ...webApiRoutes, ...hidden.routes },
      baseURL!,
    );
    await page.goto("/dashboard");
    await expect(page.getByText("Recommended Agents")).toBeVisible();

    expect(calls.calls("GET", "/credits/transactions")).toHaveLength(0);
  });

  test("Plans for today: today's sessions with their name and description", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    // Sessions of the browser's local day (same machine, same time zone).
    const todayAt = (hour: number, minute = 0) => {
      const d = new Date();
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    };
    const session = (
      id: string,
      title: string,
      hours: [number, number],
      extra: Record<string, unknown> = {},
    ) => ({
      id,
      projectId: null,
      title,
      type: "RECORDING",
      status: "PLANNED",
      startAt: todayAt(hours[0]),
      endAt: todayAt(hours[1]),
      notes: null,
      ...extra,
    });
    const events = await mockApi(
      context,
      {
        ...webApiRoutes,
        ...backend.routes,
        "/tools/content-planner/events": {
          data: [
            session("e1", "Record the unboxing", [11, 13], {
              notes: "Two cameras, natural light by the window.",
            }),
            session("e2", "Edit the vlog", [15, 17], {
              type: "EDITING",
              notes: "Cut the intro under 10 seconds.",
            }),
            session("e3", "Cancelled call", [9, 10], { status: "CANCELLED" }),
            session("e4", "Morning script", [8, 9], {
              notes: "Outline the three key points.",
            }),
          ],
        },
      },
      baseURL!,
    );
    const plannerRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/tools/content-planner/events")) {
        plannerRequests.push(r.url());
      }
    });
    // The browser's clock: today at 10:30.
    const fixed = new Date();
    fixed.setHours(10, 30, 0, 0);
    await page.clock.setFixedTime(fixed);
    await openDashboard(page);

    const widget = cell(page, "today-plans");
    await expect(widget.getByText("Plans for today")).toBeVisible();
    await expect(widget.getByText("Record the unboxing")).toBeVisible();
    await expect(
      widget.getByText("Two cameras, natural light by the window."),
    ).toBeVisible();
    await expect(widget.getByText("Edit the vlog")).toBeVisible();
    await expect(
      widget.getByText("Cut the intro under 10 seconds."),
    ).toBeVisible();
    await expect(widget.getByText("Cancelled call")).toHaveCount(0);

    // Closest to now (10:30) first: in 30 min, 1 h 30 min ago, in 4 h 30 min.
    expect(
      await widget
        .locator("[data-plan-id]")
        .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-plan-id"))),
    ).toEqual(["e1", "e4", "e2"]);

    // On the right: the time to each session, or how long ago it passed.
    const countdown = (id: string) =>
      widget.locator(`[data-plan-id="${id}"] [data-countdown]`);
    await expect(countdown("e1")).toHaveText("in 30 min");
    await expect(countdown("e2")).toHaveText("in 4 h 30 min");
    // Its time is over and it isn't done: red.
    const missed = widget.locator('[data-plan-id="e4"]');
    await expect(missed).toHaveAttribute("data-overdue", "true");
    await expect(countdown("e4")).toHaveText("1 h 30 min ago");
    expect(
      await countdown("e4").evaluate((el) => getComputedStyle(el).color),
    ).toBe("rgb(248, 113, 113)"); // --color-error
    expect(
      await widget.locator('[data-plan-id="e1"]').getAttribute("data-overdue"),
    ).toBeNull();

    // Asked for the user's own day: local midnight to local midnight.
    const [request] = events.calls("GET", "/tools/content-planner/events");
    expect(request).toBeTruthy();
    const day = await page.evaluate(() => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return { from: from.toISOString(), to: to.toISOString() };
    });
    expect(
      await widget
        .getByRole("link", { name: /Record the unboxing/ })
        .getAttribute("href"),
    ).toBe(`/tools/content-planner?date=${encodeURIComponent(todayAt(11))}`);
    // The mock records paths only: read the query from the request itself.
    const params = plannerRequests[0];
    expect(params).toContain(`from=${encodeURIComponent(day.from)}`);
    expect(params).toContain(`to=${encodeURIComponent(day.to)}`);
    await snap(page, testInfo, "dashboard plans for today");
  });

  test("Likes & views: totals, still previews; a shared asset opens in a new tab", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const still = (color: string) =>
      `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${color}"/></svg>`,
      )}`;
    const asset = (
      id: string,
      type: "IMAGE" | "VIDEO",
      title: string,
      likeCount: number,
      viewCount: number,
      previewUrl: string | null,
      isPublic = true,
    ) => ({
      id,
      type,
      title,
      previewUrl,
      likeCount,
      viewCount,
      isPublic,
      createdAt: new Date().toISOString(),
    });
    const api = await mockApi(
      context,
      {
        ...webApiRoutes,
        ...backend.routes,
        "/user/assets/engagement": {
          totals: { likes: 1280, views: 45210, assets: 14, publicAssets: 3 },
          top: [
            asset(
              "img1",
              "IMAGE",
              "Neon gaming thumbnail",
              1200,
              38000,
              still("#a21caf"),
            ),
            asset("vid1", "VIDEO", "Launch teaser", 64, 6900, still("#f59e0b")),
            asset("vid2", "VIDEO", "Behind the scenes", 1, 0, null, false),
          ],
        },
      },
      baseURL!,
    );
    const videoRequests: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() === "media" || /\.(mp4|webm)(\?|$)/.test(r.url())) {
        videoRequests.push(r.url());
      }
    });
    await openDashboard(page);

    // Below the fold: it loads (code + data) as it comes near.
    const widget = cell(page, "asset-stats");
    await widget.scrollIntoViewIfNeeded();
    await expect(widget.getByText("Likes & views")).toBeVisible();
    await expect(widget.getByText("1,280")).toBeVisible();
    await expect(widget.getByText("45,210")).toBeVisible();
    expect(api.calls("GET", "/user/assets/engagement")).toHaveLength(1);

    // Same size as "Plans for today": half a row on desktops.
    const width = async (id: string) =>
      (await cell(page, id).boundingBox())!.width;
    expect(Math.round(await width("asset-stats"))).toBe(
      Math.round(await width("today-plans")),
    );

    // Each asset: a still preview, its likes and views.
    const tile = (id: string) => widget.locator(`[data-asset-id="${id}"]`);
    await expect(tile("img1")).toContainText("Neon gaming thumbnail");
    await expect(tile("img1")).toContainText("1.2K");
    await expect(tile("img1")).toContainText("38K");
    await expect
      .poll(() =>
        tile("img1")
          .locator("img")
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    // Videos: a thumbnail or a placeholder — never a video.
    await expect(tile("vid1")).toContainText("Video");
    await expect(tile("vid1").locator("img")).toHaveCount(1);
    await expect(tile("vid2").locator('[data-preview="none"]')).toHaveAttribute(
      "title",
      "No preview",
    );
    await expect(page.locator("video")).toHaveCount(0);
    expect(videoRequests).toEqual([]);

    await expect(tile("vid2").getByRole("link")).toHaveAttribute(
      "href",
      "/assets",
    );
    await expect(tile("vid2").getByRole("link")).not.toHaveAttribute(
      "target",
      /.*/,
    );
    await snap(page, testInfo, "dashboard likes and views");

    // A shared asset opens its public page in a new tab; the dashboard stays.
    const [shareTab] = await Promise.all([
      context.waitForEvent("page"),
      tile("vid1").getByRole("link").click(),
    ]);
    await shareTab.waitForLoadState("domcontentloaded");
    expect(new URL(shareTab.url()).pathname).toBe("/share/vid1");
    // No access to the dashboard from the new tab (rel="noopener").
    expect(await shareTab.evaluate(() => window.opener)).toBeNull();
    expect(new URL(page.url()).pathname).toBe("/dashboard");
    await expect(widget.getByText("1,280")).toBeVisible();
    await shareTab.close();
  });

  test("Pro tip: a tip from the JSON content, another one the next hour", async ({
    page,
  }) => {
    const tips = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../web/src/content/pro-tips/en.json"),
        "utf8",
      ),
    ) as { tips: { id: string; title: string }[] };
    const shownTip = async () => {
      const widget = cell(page, "tips");
      await widget.scrollIntoViewIfNeeded();
      const article = widget.locator("[data-tip-id]");
      await expect(article).toBeVisible();
      await expect(widget.getByText(/^Tip \d+ of 100$/)).toBeVisible();
      return article.getAttribute("data-tip-id");
    };

    const at = new Date();
    at.setHours(10, 15, 0, 0);
    await page.clock.setFixedTime(at);
    await openDashboard(page);
    const first = await shownTip();
    const tip = tips.tips.find((t) => t.id === first)!;
    expect(tip).toBeTruthy();
    await expect(cell(page, "tips").getByText(tip.title)).toBeVisible();

    // Same hour: same tip after a reload.
    at.setMinutes(50);
    await page.clock.setFixedTime(at);
    await page.reload();
    expect(await shownTip()).toBe(first);

    // Next hour: another tip.
    at.setHours(11, 5);
    await page.clock.setFixedTime(at);
    await page.reload();
    expect(await shownTip()).not.toBe(first);
  });

  test("rearranging passes the accessibility gate", async ({
    page,
  }, testInfo) => {
    await openDashboard(page);
    await page.getByRole("button", { name: "Customize dashboard" }).click();
    await expect(editBarDone(page)).toBeVisible();
    await expectAccessible(page, testInfo, "dashboard rearranging");
  });

  test("reduced motion: no wobble while rearranging", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDashboard(page);
    await page.getByRole("button", { name: "Customize dashboard" }).click();

    const wobble = cell(page, "tips").locator("[data-widget-wobble]");
    expect(
      await wobble.evaluate(
        (el) => getComputedStyle(el).animationIterationCount,
      ),
    ).toBe("1");
  });
});

test.describe("dashboard widgets · phone", () => {
  test.use(VIEWPORTS.phone.use);

  let backend: ReturnType<typeof layoutBackend>;

  test.beforeEach(async ({ context, baseURL }) => {
    backend = layoutBackend();
    await mockApi(context, { ...webApiRoutes, ...backend.routes }, baseURL!);
    await signInWeb(context, baseURL!);
  });

  test("a finger held on a widget picks it up; a swipe still scrolls", async ({
    page,
  }, testInfo) => {
    await openDashboard(page);
    const cdp = await page.context().newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      points: { x: number; y: number }[],
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((p, id) => ({ ...p, id })),
      });

    // A quick swipe over a widget is a scroll, not a drag.
    const from = await center(page, "favorites", 0.5, 0.05);
    await touch("touchStart", [from]);
    for (let i = 1; i <= 5; i++) {
      await touch("touchMove", [{ x: from.x, y: from.y - i * 12 }]);
    }
    await touch("touchEnd", []);
    await expect(editBarDone(page)).toHaveCount(0);

    // Press and hold, then drag it above the quick prompt.
    await page.evaluate(() => document.querySelector("main")!.scrollTo(0, 0));
    const press = await center(page, "favorites", 0.5, 0.05);
    await touch("touchStart", [press]);
    await page.waitForTimeout(550);
    await expect(editBarDone(page)).toBeVisible();
    const target = await center(page, "quick-prompt", 0.5, 0.3);
    for (let i = 1; i <= 12; i++) {
      await touch("touchMove", [
        {
          x: press.x + ((target.x - press.x) * i) / 12,
          y: press.y + ((target.y - press.y) * i) / 12,
        },
      ]);
    }
    await expect
      .poll(async () => (await order(page)).slice(0, 2))
      .toEqual(["favorites", "quick-prompt"]);
    await snap(page, testInfo, "dashboard widget touch drag");
    await touch("touchEnd", []);
    await expect.poll(() => backend.current()[0]!.id).toBe("favorites");

    // The rearranging controls are thumb-sized and nothing overflows.
    await expectTouchTarget(
      page.getByRole("button", { name: "Hide Recent activity" }),
    );
    await expectTouchTarget(editBarDone(page));
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Settings → Dashboard", () => {
  let backend: ReturnType<typeof layoutBackend>;

  test.beforeEach(async ({ context, baseURL }) => {
    backend = layoutBackend();
    await mockApi(context, { ...webApiRoutes, ...backend.routes }, baseURL!);
    await signInWeb(context, baseURL!);
  });

  test("choose a widget with its preview, order it, and see it on the dashboard", async ({
    page,
  }, testInfo) => {
    await page.goto("/settings#dashboard");
    const card = page.locator("#dashboard");
    await expect(
      card.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    const preview = card.getByRole("figure", {
      name: "Preview of your dashboard",
    });
    await expect(
      preview.locator('[data-preview-widget="credits"]'),
    ).toHaveCount(1);

    for (let i = 0; i < 7; i++) {
      await card.getByRole("button", { name: "Move Credits up" }).click();
    }
    await expect
      .poll(() => backend.current()[0])
      .toEqual({ id: "credits", visible: true });

    await card.getByRole("button", { name: "Phone" }).click();
    await expect(preview).toHaveAttribute("data-device", "phone");
    await snap(page, testInfo, "settings dashboard widgets");
    await expectAccessible(page, testInfo, "settings dashboard widgets");

    await card.getByRole("link", { name: "Open dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Buy credits" })).toBeVisible();
    expect((await order(page))[0]).toBe("credits");
  });

  test("'Add widgets' on the dashboard leads here; reset restores the default", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Customize dashboard" }).click();
    await page.getByRole("link", { name: "Add widgets" }).click();
    await expect(page).toHaveURL(/\/settings#dashboard$/);
    const card = page.locator("#dashboard");
    await expect(card).toBeInViewport();

    await card.getByRole("button", { name: "Move Recent activity up" }).click();
    const reset = card.getByRole("button", { name: "Reset to default" });
    await expect(reset).toBeEnabled();
    await reset.click();
    await expect(reset).toBeDisabled();
    expect(backend.current().map((w) => w.id)).toEqual(
      DEFAULT_LAYOUT.map((w) => w.id),
    );
  });
});
