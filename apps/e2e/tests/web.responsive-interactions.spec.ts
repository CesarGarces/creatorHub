import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { openChat, signInWeb } from "../fixtures/web-data";
import { PLANNER_EVENTS, webPageRoutes } from "../fixtures/web-pages";
import {
  VIEWPORTS,
  expectInsideViewport,
  expectInsideViewportX,
  expectNoHorizontalOverflow,
  expectTouchTarget,
  fontSizeOf,
  openVirtualKeyboard,
  overlaps,
  snap,
} from "../fixtures/responsive";

/**
 * Touch interactions on phones/tablets: the assistant chat and dialogs with
 * the on-screen keyboard open, card actions without hover, the calendar
 * views and the tools' history drawers.
 */

test.beforeEach(async ({ context, baseURL }) => {
  await mockApi(context, webPageRoutes, baseURL!);
  await signInWeb(context, baseURL!);
});

/** The bottom edge of `locator` is above the (possibly shrunk) viewport's. */
async function expectAboveKeyboard(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      return box ? box.y + box.height : Infinity;
    })
    .toBeLessThanOrEqual(page.viewportSize()!.height + 1);
}

test.describe("assistant chat · phone", () => {
  test.use(VIEWPORTS.phone.use);

  test("opens full screen and its composer stays above the keyboard", async ({
    page,
  }, testInfo) => {
    await page.goto("/dashboard");
    await openChat(page, "tap");

    const panel = page.getByRole("dialog", { name: "Chat" });
    await expect(panel).toBeVisible();
    // Full screen once the slide-in has finished.
    await expect.poll(async () => (await panel.boundingBox())!.x).toBe(0);
    const box = (await panel.boundingBox())!;
    expect(box.width).toBe(390);
    expect(box.height).toBe(844);

    // Header actions are thumb-sized.
    for (const label of ["New chat", "Chat settings", "Close chat"]) {
      await expectTouchTarget(panel.getByRole("button", { name: label }));
    }
    // Session chips: delete is visible without hover on touch screens.
    const remove = panel.getByRole("button", {
      name: "Delete Thumbnail ideas for my gaming channel",
    });
    await expect(remove).toBeVisible();
    expect(await remove.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );

    const input = panel.getByRole("textbox", { name: "Chat message" });
    // 16px: iOS does not zoom the page when the field gets focus.
    expect(await fontSizeOf(input)).toBeGreaterThanOrEqual(16);
    await input.tap();
    await input.fill("Ideas for a cooking video");
    await snap(page, testInfo, "chat keyboard closed");

    const closeKeyboard = await openVirtualKeyboard(page, 336);
    // The panel shrinks with the visible area: header and composer stay.
    await expect
      .poll(async () => (await panel.boundingBox())!.height)
      .toBe(844 - 336);
    await expectInsideViewport(input);
    await expectInsideViewport(
      panel.getByRole("button", { name: "Send message" }),
    );
    await expectInsideViewport(
      panel.getByRole("button", { name: "Close chat" }),
    );
    await snap(page, testInfo, "chat keyboard open");

    await closeKeyboard();
    await expect
      .poll(async () => (await panel.boundingBox())!.height)
      .toBe(844);
    await panel.getByRole("button", { name: "Close chat" }).tap();
    await expect(panel).toBeHidden();
  });

  for (const path of [
    "/tools/script-writer",
    "/tools/x-post-tweet",
    "/tools/x-search-trends",
  ]) {
    test(`${path}: the chat button never covers the composer`, async ({
      page,
    }) => {
      await page.goto(path);
      const fab = page.getByRole("button", { name: "Open chat" });
      const composer = page.locator("[data-composer]");
      await expect(fab).toBeVisible();
      await expect(composer).toBeVisible();
      expect(await overlaps(fab, composer)).toBe(false);
      await expectInsideViewport(composer);

      // Message field and send button share the first row.
      const field = composer.getByRole("textbox");
      const send = composer.getByRole("button", { name: /^Send/ });
      await expectTouchTarget(send);
      const [f, s] = await Promise.all([
        field.boundingBox(),
        send.boundingBox(),
      ]);
      expect(
        Math.abs(f!.y + f!.height / 2 - (s!.y + s!.height / 2)),
      ).toBeLessThan(4);
      expect(f!.width).toBeGreaterThan(200);

      // Typing with the keyboard open keeps the composer visible.
      await field.tap();
      await openVirtualKeyboard(page);
      await expectAboveKeyboard(page, composer);
    });
  }
});

test.describe("tool history drawers · phone", () => {
  test.use(VIEWPORTS.phone.use);

  test("script history is closed by default and opens over the chat", async ({
    page,
  }, testInfo) => {
    await page.goto("/tools/script-writer");
    await expect(page.getByText("Script History")).toBeHidden();

    const toggle = page.getByRole("button", { name: "Show History" });
    await expectTouchTarget(toggle);
    await toggle.tap();
    await expect(page.getByText("Script History")).toBeVisible();
    const script = page.getByText("10 tips to grow on YouTube in 2026");
    await expect(script).toBeVisible();
    // Delete is visible without hover.
    const remove = page.getByRole("button", { name: "Delete script" });
    expect(await remove.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );
    await snap(page, testInfo, "script history drawer");

    await page.getByRole("button", { name: "Hide History" }).tap();
    await expect(page.getByText("Script History")).toBeHidden();
  });

  test("X post history opens and a tap outside closes it", async ({ page }) => {
    await page.goto("/tools/x-post-tweet");
    await page.getByRole("button", { name: "Show History" }).tap();
    await expect(page.getByText("Launching my new course")).toBeVisible();
    await page.touchscreen.tap(370, 400);
    await expect(page.getByText("Launching my new course")).toBeHidden();
  });
});

test.describe("dialogs and the on-screen keyboard · phone", () => {
  test.use(VIEWPORTS.phoneSmall.use);

  test("buy credits: the dialog fits, its buttons stay reachable while typing", async ({
    page,
  }, testInfo) => {
    await page.goto("/credits");
    await page.getByRole("button", { name: "Buy More Credits" }).tap();
    const dialog = page.getByRole("dialog", { name: "Buy Credits" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);

    const amount = dialog.getByLabel("Amount in US dollars");
    expect(await fontSizeOf(amount)).toBeGreaterThanOrEqual(16);
    await amount.tap();
    await openVirtualKeyboard(page, 300);
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box!.y + box!.height;
      })
      .toBeLessThanOrEqual(740 - 300 + 1);
    const pay = dialog.getByRole("button", { name: /Pay/ });
    await pay.scrollIntoViewIfNeeded();
    await expectInsideViewport(pay);
    await expectTouchTarget(pay);
    await snap(page, testInfo, "buy credits with keyboard");
  });

  test("plan checkout modal fits a small phone", async ({ page }, testInfo) => {
    await page.goto("/credits");
    await page
      .getByRole("button", { name: "Buy Credits", exact: true })
      .first()
      .tap();
    const dialog = page.getByRole("dialog", { name: "Get started now" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);
    await expect(dialog.getByText("Selected Plan")).toBeVisible();
    await snap(page, testInfo, "checkout modal");
  });

  test("calendar session dialog keeps Save on screen while editing", async ({
    page,
  }, testInfo) => {
    await page.goto("/tools/content-planner");
    await page
      .getByRole("button", { name: new RegExp(PLANNER_EVENTS[0]!.title) })
      .first()
      .tap();
    const dialog = page.getByRole("dialog", { name: "Edit session" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);

    const title = dialog.getByRole("textbox", { name: "Title" });
    await title.tap();
    await openVirtualKeyboard(page, 300);
    await expectAboveKeyboard(page, dialog);
    const save = dialog.getByRole("button", { name: "Save changes" });
    await save.scrollIntoViewIfNeeded();
    await expectInsideViewport(save);
    await expectTouchTarget(save);
    await snap(page, testInfo, "planner session dialog with keyboard");
  });

  test("the AI planner dialog fits and its actions are reachable", async ({
    page,
  }) => {
    await page.goto("/tools/content-planner");
    await page.getByRole("button", { name: "Plan with AI" }).tap();
    const dialog = page.getByRole("dialog", { name: "AI planning assistant" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await cancel.scrollIntoViewIfNeeded();
    await expectInsideViewport(cancel);
    await cancel.tap();
    await expect(dialog).toBeHidden();
  });
});

test.describe("cards and buttons without hover · phone", () => {
  test.use(VIEWPORTS.phone.use);

  test("asset cards show every action, preview and share fit the screen", async ({
    page,
  }, testInfo) => {
    await page.goto("/assets");
    const card = page
      .locator("div.group")
      .filter({ hasText: "Gaming thumbnail with neon lights" })
      .first();
    await expect(card).toBeVisible();
    for (const label of ["Use prompt", "Download", "Share", "Delete asset"]) {
      const button = card.getByRole("button", { name: label });
      await expect(button).toBeVisible();
      await expectInsideViewportX(button);
      await expectTouchTarget(button, 40);
    }

    await card.locator("img").first().tap();
    const preview = page.getByRole("dialog", {
      name: "Gaming thumbnail with neon lights and a shocked face",
    });
    await expect(preview).toBeVisible();
    await expectInsideViewport(preview);
    const shareButton = preview.getByRole("button", { name: "Share" });
    await expectInsideViewportX(shareButton);
    await snap(page, testInfo, "asset preview");

    // Share opens on top of the preview.
    await shareButton.tap();
    const share = page.getByRole("dialog", { name: "Share Asset" });
    await expect(share).toBeVisible();
    await expectInsideViewport(share);
    await expect(share.getByRole("button", { name: "Copy" })).toBeVisible();
    await snap(page, testInfo, "share modal over preview");
  });

  test("asset preview: Instagram-style pinch lifts the image over a blurred page", async ({
    page,
  }, testInfo) => {
    await page.goto("/assets");
    await page
      .locator("div.group")
      .filter({ hasText: "Gaming thumbnail with neon lights" })
      .first()
      .locator("img")
      .first()
      .tap();
    const preview = page.getByRole("dialog", {
      name: "Gaming thumbnail with neon lights and a shocked face",
    });
    await expect(preview).toBeVisible();
    const viewer = preview.getByRole("group", { name: "Image viewer" });
    await expect(viewer).toHaveAttribute("data-zoom-scale", "1.00");
    // No zoom buttons: the gesture is the interface.
    for (const label of ["Zoom in", "Zoom out", "Reset zoom"]) {
      await expect(page.getByRole("button", { name: label })).toHaveCount(0);
    }
    // One finger still scrolls; a pinch never zooms the page.
    expect(
      await viewer.evaluate((el) => getComputedStyle(el).touchAction),
    ).toBe("pan-x pan-y");

    // Measure once the opening animation has finished.
    await page.evaluate(() =>
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
    const close = preview.getByRole("button", { name: "Close preview" });
    const closeBefore = (await close.boundingBox())!;
    const dialogBefore = (await preview.boundingBox())!;
    const frame = (await viewer.boundingBox())!;
    const cx = frame.x + frame.width / 2;
    const cy = frame.y + frame.height / 2;

    const cdp = await page.context().newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      points: { x: number; y: number }[],
    ) =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: points.map((p, id) => ({ ...p, id })),
      });
    const fingers = (gap: number) => [
      { x: cx - gap, y: cy },
      { x: cx + gap, y: cy },
    ];
    const layer = page.locator("[data-zoom-layer]");
    const zoomed = layer.locator("img");
    const backdrop = page.locator("[data-zoom-backdrop]");

    // Two fingers spreading apart, still on the screen.
    await touch("touchStart", fingers(20));
    for (let gap = 25; gap <= 50; gap += 5) {
      await touch("touchMove", fingers(gap));
    }
    await expect(viewer).toHaveAttribute("data-zooming", "true");
    await expect
      .poll(async () => Number(await viewer.getAttribute("data-zoom-scale")))
      .toBeGreaterThan(2);
    // The image grows past the dialog, over the whole screen…
    const grown = (await zoomed.boundingBox())!;
    expect(grown.width).toBeGreaterThan(dialogBefore.width);
    expect(grown.x).toBeLessThan(dialogBefore.x);
    // …above a blurred, dimmed page…
    expect(await backdrop.evaluate((el) => getComputedStyle(el).opacity)).toBe(
      "1",
    );
    expect(
      await backdrop.evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toContain("blur");
    // …while the original spot is left empty.
    expect(
      await viewer
        .getByRole("img")
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("0");
    // The page itself did not zoom or move.
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(
      1,
    );
    expect(await close.boundingBox()).toEqual(closeBefore);
    expect(await preview.boundingBox()).toEqual(dialogBefore);
    await snap(page, testInfo, "asset preview pinching");

    // Moving both fingers drags the lifted image along.
    await touch("touchMove", [
      { x: cx - 50, y: cy + 60 },
      { x: cx + 50, y: cy + 60 },
    ]);
    await expect
      .poll(async () => (await zoomed.boundingBox())!.y)
      .toBeGreaterThan(grown.y + 40);

    // Releasing springs the image back and removes the blur.
    await touch("touchEnd", []);
    await expect(layer).toHaveCount(0);
    await expect(viewer).not.toHaveAttribute("data-zooming");
    await expect(viewer).toHaveAttribute("data-zoom-scale", "1.00");
    expect(
      await viewer
        .getByRole("img")
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("1");
    expect(await viewer.boundingBox()).toEqual(frame);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(
      1,
    );
    await expect(close).toBeVisible();
    await snap(page, testInfo, "asset preview released");

    // A one-finger swipe on the image scrolls, it does not zoom.
    await touch("touchStart", [{ x: cx, y: cy }]);
    await touch("touchMove", [{ x: cx, y: cy - 30 }]);
    await touch("touchEnd", []);
    await expect(layer).toHaveCount(0);
    await expect(viewer).toHaveAttribute("data-zoom-scale", "1.00");
  });

  test("tool cards: favourites are thumb-sized and cards stay in the column", async ({
    page,
  }) => {
    await page.goto("/tools");
    const favourites = page.getByRole("button", {
      name: /Add to favorites|Remove from favorites/,
    });
    await expect(favourites.first()).toBeVisible();
    for (const button of await favourites.all()) {
      await expectTouchTarget(button);
      await expectInsideViewportX(button);
    }
    await expectNoHorizontalOverflow(page);
  });

  test("dashboard favourites: the drag handle is usable by touch", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const handle = page.getByRole("button", {
      name: /Drag to reorder Thumbnail Generator/i,
    });
    await expect(handle).toBeVisible();
    await expectTouchTarget(handle, 40);
    expect(
      await handle.evaluate((el) => getComputedStyle(el).touchAction),
    ).toBe("none");
  });
});

test.describe("content planner · calendar views", () => {
  test.describe("phone", () => {
    test.use(VIEWPORTS.phone.use);

    test("opens on the agenda, week and month scroll sideways inside the card", async ({
      page,
    }, testInfo) => {
      await page.goto("/tools/content-planner");
      const tabs = page.getByRole("tablist", { name: "Calendar view" });
      await expect(tabs.getByRole("tab", { name: "Agenda" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // Sessions in date order, done toggles are tappable.
      await expect(page.getByText("Script the unboxing video")).toBeVisible();
      await expectTouchTarget(
        page.getByRole("checkbox", { name: /Mark as (done|pending)/ }).first(),
        28,
      );
      await expectNoHorizontalOverflow(page);
      await snap(page, testInfo, "planner agenda phone");

      await tabs.getByRole("tab", { name: "Week" }).tap();
      const week = page.getByTestId("planner-week-scroller");
      await expect(week).toBeVisible();
      const scroll = await week.evaluate((el) => ({
        width: el.clientWidth,
        content: el.scrollWidth,
      }));
      expect(scroll.content).toBeGreaterThan(scroll.width);
      // Day columns keep a readable width.
      const day = await page.getByTestId("planner-day-0").boundingBox();
      expect(day!.width).toBeGreaterThanOrEqual(80);
      // The page itself does not scroll sideways — only the grid does.
      await expectNoHorizontalOverflow(page);
      await snap(page, testInfo, "planner week phone");

      await tabs.getByRole("tab", { name: "Month" }).tap();
      await expect(page.getByTestId("planner-month-scroller")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test("the agenda default does not override the user's choice", async ({
      page,
    }) => {
      await page.goto("/tools/content-planner");
      const tabs = page.getByRole("tablist", { name: "Calendar view" });
      await tabs.getByRole("tab", { name: "Week" }).tap();
      await page.getByRole("button", { name: "Open menu" }).tap();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Assets" })
        .tap();
      await expect(page).toHaveURL(/\/assets$/);
      await page.getByRole("button", { name: "Open menu" }).tap();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Planner" })
        .tap();
      await expect(tabs.getByRole("tab", { name: "Week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });
  });

  test.describe("tablet", () => {
    test.use(VIEWPORTS.tablet.use);

    test("the week grid fits without scrolling sideways", async ({
      page,
    }, testInfo) => {
      await page.goto("/tools/content-planner");
      const tabs = page.getByRole("tablist", { name: "Calendar view" });
      await expect(tabs.getByRole("tab", { name: "Week" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      const week = page.getByTestId("planner-week-scroller");
      const scroll = await week.evaluate((el) => ({
        width: el.clientWidth,
        content: el.scrollWidth,
      }));
      expect(scroll.content).toBeLessThanOrEqual(scroll.width);
      await expectNoHorizontalOverflow(page);
      await snap(page, testInfo, "planner week tablet");
    });
  });
});
