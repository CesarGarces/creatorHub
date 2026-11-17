import { expect, test, type Locator, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { signInWeb } from "../fixtures/web-data";
import { webPageRoutes } from "../fixtures/web-pages";
import {
  VIEWPORTS,
  expectInsideViewport,
  expectTouchTarget,
} from "../fixtures/responsive";

/**
 * The floating assistant launcher: expanded on load, tucked into an edge
 * tab after 5 s idle or on scroll, back on hover/focus/first tap — with no
 * layout shift and without covering the content beside it (e.g. the
 * "Recent analyses" delete buttons of the Video Clipper).
 */

const launcher = (page: Page) =>
  page.getByRole("button", { name: "Open chat" });
/** The visible pill/tab inside the fixed slot. */
const pill = (page: Page) => launcher(page).locator("> span");

async function recordLayoutShifts(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __shifts: number[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        w.__shifts.push((entry as unknown as { value: number }).value);
      }
    }).observe({ type: "layout-shift" });
  });
}

const layoutShifts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts);

/** The point at the centre of `target` really hits it (nothing on top). */
async function expectClickable(target: Locator) {
  const hit = await target.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(
      r.x + r.width / 2,
      r.y + r.height / 2,
    );
    return !!top && (top === el || el.contains(top));
  });
  expect(hit, "nothing covers the element").toBe(true);
}

async function expectTuckedAgainstEdge(page: Page) {
  const width = page.viewportSize()!.width;
  await expect(async () => {
    const box = (await pill(page).boundingBox())!;
    // Tucked 12px past the right edge: 44px visible.
    expect(Math.round(box.x + box.width - width)).toBe(12);
    expect(Math.round(width - box.x)).toBe(44);
  }).toPass();
}

for (const [screen, use] of [
  ["desktop", { viewport: { width: 1280, height: 800 } }],
  ["phone", VIEWPORTS.phone.use],
] as const) {
  test.describe(`chat launcher · ${screen}`, () => {
    test.use(use);

    test.beforeEach(async ({ context, baseURL }) => {
      await mockApi(context, webPageRoutes, baseURL!);
      await signInWeb(context, baseURL!);
    });

    test("tucks into an edge tab after 5 s without layout shift", async ({
      page,
    }) => {
      await page.goto("/tools/video-clipper");
      await expect(launcher(page)).toHaveAttribute("data-state", "expanded");
      await expect(page.getByRole("tooltip")).toContainText(
        "Do you need help?",
      );
      await recordLayoutShifts(page);

      await expect(launcher(page)).toHaveAttribute("data-state", "collapsed", {
        timeout: 8_000,
      });
      await expect(page.getByRole("tooltip")).toBeHidden();
      await expectTuckedAgainstEdge(page);
      // Still reachable and thumb-sized.
      await expectInsideViewport(launcher(page));
      await expectTouchTarget(launcher(page));
      await page.waitForTimeout(400); // transition finished
      expect(await layoutShifts(page)).toEqual([]);
    });

    test("collapses on scroll and never covers the content beside it", async ({
      page,
    }) => {
      await page.goto("/tools/video-clipper");
      const del = page.getByRole("button", {
        name: "Delete the analysis of pasta-vlog.mp4",
      });
      await expect(del).toBeVisible();
      await expect(launcher(page)).toHaveAttribute("data-state", "expanded");

      // Bring the last row to the bottom of the screen (scrolls <main>).
      await page
        .locator("main")
        .evaluate((main) => main.scrollTo(0, main.scrollHeight));
      await page.mouse.wheel(0, 400);
      await expect(launcher(page)).toHaveAttribute("data-state", "collapsed");
      await expectClickable(del);

      // Expanded again (hover / first tap): still not on top of the row.
      if (screen === "desktop") await pill(page).hover();
      else await launcher(page).tap();
      await expect(launcher(page)).toHaveAttribute("data-state", "expanded");
      await expectClickable(del);
    });

    test(
      screen === "desktop"
        ? "hover expands the tab and a click opens the chat"
        : "first tap expands the tab, the second opens the chat",
      async ({ page }) => {
        await page.goto("/dashboard");
        await page
          .locator("main")
          .evaluate((main) => main.dispatchEvent(new Event("scroll")));
        await expect(launcher(page)).toHaveAttribute("data-state", "collapsed");

        if (screen === "desktop") {
          await pill(page).hover();
          await expect(launcher(page)).toHaveAttribute(
            "data-state",
            "expanded",
          );
          await page.waitForTimeout(6_000); // held while hovered
          await expect(launcher(page)).toHaveAttribute(
            "data-state",
            "expanded",
          );
          await launcher(page).click();
        } else {
          await launcher(page).tap();
          await expect(launcher(page)).toHaveAttribute(
            "data-state",
            "expanded",
          );
          await expect(page.getByRole("dialog", { name: "Chat" })).toBeHidden();
          await launcher(page).tap();
        }
        await expect(page.getByRole("dialog", { name: "Chat" })).toBeVisible();
      },
    );
  });
}

test.describe("chat launcher · keyboard", () => {
  test("focus expands the collapsed tab and Enter opens the chat", async ({
    page,
    context,
    baseURL,
  }) => {
    await mockApi(context, webPageRoutes, baseURL!);
    await signInWeb(context, baseURL!);
    await page.goto("/dashboard");
    await page
      .locator("main")
      .evaluate((main) => main.dispatchEvent(new Event("scroll")));
    await expect(launcher(page)).toHaveAttribute("data-state", "collapsed");
    await launcher(page).focus();
    await expect(launcher(page)).toHaveAttribute("data-state", "expanded");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Chat" })).toBeVisible();
  });
});
