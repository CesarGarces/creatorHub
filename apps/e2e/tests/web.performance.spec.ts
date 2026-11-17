import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { dismissCookieBanner, signInWeb } from "../fixtures/web-data";
import {
  PUBLIC_WEB_PAGES,
  WEB_PAGES,
  webPageRoutes,
  type PageSpec,
} from "../fixtures/web-pages";
import { VIEWPORTS } from "../fixtures/responsive";
import {
  expectResponsive,
  observeVitals,
  pageNow,
  readVitals,
  reportAndCheck,
  throttleLikeAPhone,
  writeVitalsReport,
} from "../fixtures/web-vitals";

/**
 * Performance telemetry of every web app page (production build), on a
 * phone with a 4× slower CPU and 4G, and on a desktop:
 * - gated: layout stability (CLS < 0.1), instant first paint (FCP < 1.8 s),
 *   LCP < 2.5 s on desktop, and interaction latency (INP < 200 ms on
 *   desktop; never "poor", 500 ms, on the throttled phone);
 * - reported: TBT, LCP and INP > 200 ms on the throttled phone (warnings).
 * Lab observers and the app's own field reporter (WebVitalsReporter) are
 * both checked. Results: artifacts/perf/web-web-vitals.{jsonl,md}.
 */

const SCREENS = [
  ["phone", VIEWPORTS.phone.use, true],
  ["desktop", { viewport: { width: 1280, height: 800 } }, false],
] as const;

const pages: (PageSpec & { public?: boolean })[] = [
  ...WEB_PAGES,
  ...PUBLIC_WEB_PAGES.map((p) => ({ ...p, public: true })),
];

test.afterAll(({}, testInfo) => writeVitalsReport(testInfo.project.name));

for (const [screen, use, throttled] of SCREENS) {
  test.describe(`web vitals · ${screen}${throttled ? " (4× CPU, 4G)" : ""}`, () => {
    test.use(use);

    for (const spec of pages) {
      test(spec.path, async ({ page, context, baseURL }, testInfo) => {
        await mockApi(context, webPageRoutes, baseURL!);
        if (spec.public) await dismissCookieBanner(context);
        else await signInWeb(context, baseURL!);
        await observeVitals(context);
        if (throttled) await throttleLikeAPhone(page);

        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();
        const vitals = await readVitals(page, await pageNow(page));
        await reportAndCheck(testInfo, screen, spec.path, vitals, {
          gateLcp: !throttled,
        });
      });
    }
  });
}

test.describe("web responsiveness (INP)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await mockApi(context, webPageRoutes, baseURL!);
    await signInWeb(context, baseURL!);
    await observeVitals(context);
  });

  /** Popover, typing and the assistant chat — shared by both screens. */
  async function commonInteractions(page: Page) {
    await page.getByRole("button", { name: "Open notifications" }).click();
    await expect(page.getByText("No notifications")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("textbox").first().click();
    await page.keyboard.type("Ideas for a cooking video", { delay: 40 });
    await page.getByRole("button", { name: "Open chat" }).click();
    await expect(page.getByRole("dialog", { name: "Chat" })).toBeVisible();
    await page.getByRole("button", { name: "Close chat" }).click();
  }

  test.describe("phone (4× CPU, 4G)", () => {
    test.use(VIEWPORTS.phone.use);

    test("drawer, popover, typing and chat respond", async ({
      page,
    }, testInfo) => {
      await throttleLikeAPhone(page);
      await page.goto("/dashboard");
      await expect(WEB_PAGES[0]!.ready(page)).toBeVisible();
      await page.getByRole("button", { name: "Open menu" }).tap();
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await commonInteractions(page);
      await expectResponsive(page, testInfo, { throttled: true });
    });
  });

  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("palette, popover, typing and chat respond", async ({
      page,
    }, testInfo) => {
      await page.goto("/dashboard");
      await expect(WEB_PAGES[0]!.ready(page)).toBeVisible();
      await page.keyboard.press("ControlOrMeta+k");
      await expect(
        page.getByPlaceholder("Search tools, agents, pages..."),
      ).toBeVisible();
      await page.keyboard.type("cre", { delay: 40 });
      await page.keyboard.press("Escape");
      await commonInteractions(page);
      await expectResponsive(page, testInfo, { throttled: false });
    });
  });
});
