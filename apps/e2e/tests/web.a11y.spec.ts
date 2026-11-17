import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { expectAccessible } from "../fixtures/a11y";
import { dismissCookieBanner, openChat, signInWeb } from "../fixtures/web-data";
import {
  PLANNER_EVENTS,
  PUBLIC_WEB_PAGES,
  WEB_PAGES,
  webPageRoutes,
} from "../fixtures/web-pages";
import { VIEWPORTS } from "../fixtures/responsive";

/**
 * Automated accessibility audit (axe-core) of every web app page, on a
 * phone and on a desktop, plus the screens that only exist once opened
 * (drawer, chat, dialogs, popovers, command palette, cookie banner).
 *
 * Gate: zero colour-contrast violations, zero missing accessible names /
 * labels, zero `critical` violations (see fixtures/a11y.ts). Other findings
 * are attached to the report.
 */

const SCREENS = [
  ["phone", VIEWPORTS.phone.use],
  ["desktop", { viewport: { width: 1280, height: 800 } }],
] as const;

for (const [screen, use] of SCREENS) {
  test.describe(`web a11y · ${screen}`, () => {
    test.use(use);

    for (const spec of WEB_PAGES) {
      test(`${spec.path}`, async ({ page, context, baseURL }, testInfo) => {
        await mockApi(context, webPageRoutes, baseURL!);
        await signInWeb(context, baseURL!);
        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();
        await expectAccessible(page, testInfo, `${screen} ${spec.path}`);
      });
    }

    for (const spec of PUBLIC_WEB_PAGES) {
      test(`${spec.path} (public)`, async ({
        page,
        context,
        baseURL,
      }, testInfo) => {
        await mockApi(context, webPageRoutes, baseURL!);
        await dismissCookieBanner(context);
        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();
        await expectAccessible(page, testInfo, `${screen} ${spec.path}`);
      });
    }
  });
}

test.describe("web a11y · opened screens · phone", () => {
  test.use(VIEWPORTS.phone.use);

  test.beforeEach(async ({ context, baseURL }) => {
    await mockApi(context, webPageRoutes, baseURL!);
    await signInWeb(context, baseURL!);
  });

  const check = (
    page: Page,
    info: Parameters<typeof expectAccessible>[1],
    n: string,
  ) => expectAccessible(page, info, `phone ${n}`);

  test("navigation drawer", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).tap();
    const drawer = page.locator("#app-sidebar");
    await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0);
    await check(page, testInfo, "navigation drawer");
  });

  test("notifications popover", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open notifications" }).tap();
    await expect(page.getByText("No notifications")).toBeVisible();
    await check(page, testInfo, "notifications");
  });

  test("command palette", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Search..." }).tap();
    await expect(
      page.getByPlaceholder("Search tools, agents, pages..."),
    ).toBeVisible();
    await check(page, testInfo, "command palette");
  });

  test("assistant chat", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    await openChat(page, "tap");
    const panel = page.getByRole("dialog", { name: "Chat" });
    await expect.poll(async () => (await panel.boundingBox())!.x).toBe(0);
    await check(page, testInfo, "chat");
  });

  test("asset preview, share modal and delete confirmation", async ({
    page,
  }, testInfo) => {
    await page.goto("/assets");
    const card = page
      .locator("div.group")
      .filter({ hasText: "Gaming thumbnail with neon lights" })
      .first();
    await card.locator("img").first().tap();
    const preview = page.getByRole("dialog", {
      name: "Gaming thumbnail with neon lights and a shocked face",
    });
    await expect(preview).toBeVisible();
    await check(page, testInfo, "asset preview");

    await preview.getByRole("button", { name: "Share" }).tap();
    await expect(
      page.getByRole("dialog", { name: "Share Asset" }),
    ).toBeVisible();
    await check(page, testInfo, "share modal");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    await page.goto("/assets");
    await page
      .locator("div.group")
      .filter({ hasText: "Gaming thumbnail with neon lights" })
      .first()
      .getByRole("button", { name: "Delete asset" })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, testInfo, "delete asset confirmation");
  });

  test("credits: buy credits and plan checkout dialogs", async ({
    page,
  }, testInfo) => {
    await page.goto("/credits");
    await page.getByRole("button", { name: "Buy More Credits" }).tap();
    await expect(
      page.getByRole("dialog", { name: "Buy Credits" }),
    ).toBeVisible();
    await check(page, testInfo, "buy credits dialog");

    await page.goto("/credits");
    await page
      .getByRole("button", { name: "Buy Credits", exact: true })
      .first()
      .tap();
    await expect(
      page.getByRole("dialog", { name: "Get started now" }),
    ).toBeVisible();
    await check(page, testInfo, "checkout dialog");
  });

  test("content planner: session and AI planner dialogs", async ({
    page,
  }, testInfo) => {
    await page.goto("/tools/content-planner");
    await page
      .getByRole("button", { name: new RegExp(PLANNER_EVENTS[0]!.title) })
      .first()
      .tap();
    await expect(
      page.getByRole("dialog", { name: "Edit session" }),
    ).toBeVisible();
    await check(page, testInfo, "planner session dialog");

    await page.goto("/tools/content-planner");
    await page.getByRole("button", { name: "Plan with AI" }).tap();
    await expect(
      page.getByRole("dialog", { name: "AI planning assistant" }),
    ).toBeVisible();
    await check(page, testInfo, "AI planner dialog");
  });

  test("tool history drawer", async ({ page }, testInfo) => {
    await page.goto("/tools/script-writer");
    await page.getByRole("button", { name: "Show History" }).tap();
    await expect(page.getByText("Script History")).toBeVisible();
    await check(page, testInfo, "script history drawer");
  });
});

test.describe("web a11y · opened screens · desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("cookie banner on a first visit", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await mockApi(context, webPageRoutes, baseURL!);
    await page.goto("/login");
    await expect(
      page.getByRole("dialog", { name: "Cookie consent" }),
    ).toBeVisible();
    await expectAccessible(page, testInfo, "desktop cookie banner");
  });

  test("command palette (Ctrl+K) and collapsed sidebar", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await mockApi(context, webPageRoutes, baseURL!);
    await signInWeb(context, baseURL!);
    await page.goto("/dashboard");
    await expect(WEB_PAGES[0]!.ready(page)).toBeVisible();
    await page.keyboard.press("ControlOrMeta+k");
    await expect(
      page.getByPlaceholder("Search tools, agents, pages..."),
    ).toBeVisible();
    await expectAccessible(page, testInfo, "desktop command palette");
  });
});
