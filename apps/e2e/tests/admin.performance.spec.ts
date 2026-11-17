import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import {
  ADMIN_PAGES,
  adminApiRoutes,
  signInAdmin,
} from "../fixtures/admin-data";
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
 * Performance telemetry of every admin page (production build), on a
 * throttled phone (4× CPU, 4G) and on a desktop. Gated: CLS < 0.1,
 * FCP < 1.8 s, desktop LCP < 2.5 s and INP (< 200 ms on desktop, never
 * "poor" on the throttled phone); reported: TBT, phone LCP and phone INP. Results: artifacts/perf/admin-web-vitals.{jsonl,md}.
 */

const SCREENS = [
  ["phone", VIEWPORTS.phone.use, true],
  ["desktop", { viewport: { width: 1280, height: 800 } }, false],
] as const;

test.afterAll(({}, testInfo) => writeVitalsReport(testInfo.project.name));

for (const [screen, use, throttled] of SCREENS) {
  test.describe(`admin vitals · ${screen}${throttled ? " (4× CPU, 4G)" : ""}`, () => {
    test.use(use);

    for (const spec of ADMIN_PAGES) {
      test(spec.path, async ({ page, context, baseURL }, testInfo) => {
        await mockApi(context, adminApiRoutes(), baseURL!);
        await signInAdmin(context, baseURL!);
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

    test("/login", async ({ page, context }, testInfo) => {
      await context.clearCookies();
      await observeVitals(context);
      if (throttled) await throttleLikeAPhone(page);
      await page.goto("/login");
      await expect(
        page.getByRole("heading", { level: 1, name: "Admin Login" }),
      ).toBeVisible();
      const vitals = await readVitals(page, await pageNow(page));
      await reportAndCheck(testInfo, screen, "/login", vitals, {
        gateLcp: !throttled,
      });
    });
  });
}

test.describe("admin responsiveness (INP)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await mockApi(context, adminApiRoutes(), baseURL!);
    await signInAdmin(context, baseURL!);
    await observeVitals(context);
  });

  /** Search typing and the status confirmation — shared by both screens. */
  async function commonInteractions(page: Page) {
    await page.getByRole("textbox", { name: "Search users..." }).click();
    await page.keyboard.type("ana", { delay: 40 });
    await page
      .getByRole("switch", { name: "Active status of Ana Creator" })
      .click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
  }

  test.describe("phone (4× CPU, 4G)", () => {
    test.use(VIEWPORTS.phone.use);

    test("drawer, typing and dialogs respond", async ({ page }, testInfo) => {
      await throttleLikeAPhone(page);
      await page.goto("/users");
      await expect(
        page.getByRole("heading", { level: 1, name: "Users" }),
      ).toBeVisible();
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

    test("typing and dialogs respond", async ({ page }, testInfo) => {
      await page.goto("/users");
      await expect(
        page.getByRole("heading", { level: 1, name: "Users" }),
      ).toBeVisible();
      await commonInteractions(page);
      await page.getByRole("link", { name: "AI Models", exact: true }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "AI Models" }),
      ).toBeVisible();
      await expectResponsive(page, testInfo, { throttled: false });
    });
  });
});
