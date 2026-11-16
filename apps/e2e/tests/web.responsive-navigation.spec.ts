import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { signInWeb } from "../fixtures/web-data";
import { webPageRoutes } from "../fixtures/web-pages";
import {
  VIEWPORTS,
  expectInsideViewport,
  expectTouchTarget,
  snap,
} from "../fixtures/responsive";

/**
 * Navigation on phones and tablets: the sidebar is an off-canvas drawer
 * (closed by default) below `lg`, docked from `lg`. Plus the keyboard
 * shortcuts (⌘K / Ctrl+K, Escape) on every form factor.
 */

const menuButton = (page: Page) =>
  page.getByRole("button", { name: "Open menu" });
const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Main navigation" });

test.beforeEach(async ({ context, baseURL }) => {
  await mockApi(context, webPageRoutes, baseURL!);
  await signInWeb(context, baseURL!);
});

for (const name of ["phoneSmall", "phone", "tablet"] as const) {
  const vp = VIEWPORTS[name];

  test.describe(`web navigation · ${vp.label}`, () => {
    test.use(vp.use);

    test("the drawer starts closed and the content gets the whole width", async ({
      page,
    }, testInfo) => {
      await page.goto("/tools/content-planner");
      await expect(
        page.getByRole("heading", { level: 1, name: "Content Planner" }),
      ).toBeVisible();

      await expect(mainNav(page)).toBeHidden();
      await expect(page.locator("#app-sidebar")).not.toBeInViewport();
      await expectTouchTarget(menuButton(page));
      await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");

      // Content starts at the left edge (no docked sidebar eating space).
      const main = await page.getByRole("main").boundingBox();
      expect(main!.x).toBe(0);
      expect(main!.width).toBe(page.viewportSize()!.width);
      await snap(page, testInfo, `${name} drawer closed`);
    });

    test("opens from the menu button, navigates and closes itself", async ({
      page,
    }, testInfo) => {
      await page.goto("/dashboard");
      await menuButton(page).tap();

      const nav = mainNav(page);
      await expect(nav).toBeVisible();
      await expect(menuButton(page)).toHaveAttribute("aria-expanded", "true");
      // Fully on screen once the slide-in transition has finished.
      const drawer = page.locator("#app-sidebar");
      await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0);
      await expectInsideViewport(drawer);
      // Focus moves into the drawer.
      await expect(
        page.getByRole("button", { name: "Close menu" }),
      ).toBeFocused();

      for (const label of [
        "Dashboard",
        "Agents",
        "Tools",
        "Planner",
        "Assets",
        "History",
        "Community Bot",
        "Credits",
        "Settings",
      ]) {
        const link = nav.getByRole("link", { name: label, exact: true });
        await expect(link).toBeVisible();
        await expectTouchTarget(link);
      }
      await expect(
        nav.getByRole("link", { name: "Dashboard", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
      await snap(page, testInfo, `${name} drawer open`);

      await nav.getByRole("link", { name: "Credits", exact: true }).tap();
      await expect(page).toHaveURL(/\/credits$/);
      await expect(
        page.getByRole("heading", { name: "Credit Plans" }),
      ).toBeVisible();
      await expect(mainNav(page)).toBeHidden();
    });

    test("closes with the close button, a tap outside and Escape", async ({
      page,
    }) => {
      await page.goto("/assets");
      const trigger = menuButton(page);

      await trigger.tap();
      await expect(mainNav(page)).toBeVisible();
      await page.getByRole("button", { name: "Close menu" }).tap();
      await expect(mainNav(page)).toBeHidden();

      await trigger.tap();
      await expect(mainNav(page)).toBeVisible();
      const { width, height } = page.viewportSize()!;
      // The backdrop is everything right of the drawer.
      await page.touchscreen.tap(width - 12, Math.round(height / 2));
      await expect(mainNav(page)).toBeHidden();

      await trigger.tap();
      await expect(mainNav(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(mainNav(page)).toBeHidden();
      // Focus returns to where the user was.
      await expect(trigger).toBeFocused();
    });

    test("the language switcher stays reachable", async ({ page }) => {
      await page.goto("/settings");
      const visibleSelector = page
        .getByTestId("language-selector")
        .locator("visible=true");
      if (name === "tablet") {
        // Tablets have room for it in the top bar.
        await expect(visibleSelector).toHaveCount(1);
        await expectInsideViewport(visibleSelector);
      } else {
        // Phones: moved into the drawer to free the top bar.
        await expect(visibleSelector).toHaveCount(0);
        await menuButton(page).tap();
        const inDrawer = page
          .locator("#app-sidebar")
          .getByTestId("language-selector");
        await expect(inDrawer).toBeVisible();
        await expectTouchTarget(inDrawer);
        await inDrawer.tap();
        await page.getByTestId("language-option-es").tap();
        await expect(page.locator("html")).toHaveAttribute("lang", "es-ES");
      }
    });

    test("the top bar keeps credits and notifications on screen", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      // Full text for screen readers everywhere; the short pill on phones.
      await expect(
        page.locator("header").getByText("1,500 credits", { exact: true }),
      ).toHaveCount(1);
      await expect(
        page
          .locator("header")
          .getByText(name === "tablet" ? "1,500 credits" : "1,500 cr", {
            exact: true,
          }),
      ).toBeVisible();
      const bell = page.getByRole("button", { name: "Open notifications" });
      await expectTouchTarget(bell);
      await expectInsideViewport(bell);

      await bell.tap();
      const popover = page.getByText("No notifications");
      await expect(popover).toBeVisible();
      await expectInsideViewport(
        page.locator("[data-radix-popper-content-wrapper]").first(),
      );
    });

    test("search opens the command palette and it fits the screen", async ({
      page,
    }, testInfo) => {
      await page.goto("/dashboard");
      const search = page.getByRole("button", { name: "Search..." });
      await expectTouchTarget(search);
      await search.tap();

      const input = page.getByPlaceholder("Search tools, agents, pages...");
      await expect(input).toBeVisible();
      await expectInsideViewport(
        page.getByRole("dialog").filter({ has: input }),
      );
      await snap(page, testInfo, `${name} command palette`);

      await input.fill("credits");
      await page
        .getByRole("option", { name: /Credits/ })
        .first()
        .tap();
      await expect(page).toHaveURL(/\/credits$/);
    });
  });
}

test.describe("web navigation · tablet landscape & desktop", () => {
  for (const [label, use] of [
    [VIEWPORTS.tabletLandscape.label, VIEWPORTS.tabletLandscape.use],
    ["desktop 1280×800", { viewport: { width: 1280, height: 800 } }],
  ] as const) {
    test.describe(label, () => {
      test.use(use);

      test("the sidebar is docked and collapsible, no menu button", async ({
        page,
      }, testInfo) => {
        await page.goto("/dashboard");
        const nav = mainNav(page);
        await expect(nav).toBeVisible();
        await expect(menuButton(page)).toBeHidden();
        await expect(
          page.getByRole("button", { name: "Close menu" }),
        ).toBeHidden();

        const aside = page.locator("#app-sidebar");
        expect((await aside.boundingBox())!.width).toBe(240);
        await page.getByRole("button", { name: "Collapse sidebar" }).click();
        await expect
          .poll(async () => (await aside.boundingBox())!.width)
          .toBe(64);
        await page.getByRole("button", { name: "Expand sidebar" }).click();
        await expect
          .poll(async () => (await aside.boundingBox())!.width)
          .toBe(240);
        await snap(page, testInfo, `${label} docked sidebar`);
      });
    });
  }
});

test.describe("web keyboard shortcuts", () => {
  for (const [label, use] of [
    ["desktop", { viewport: { width: 1280, height: 800 } }],
    [VIEWPORTS.tablet.label, VIEWPORTS.tablet.use],
  ] as const) {
    test.describe(label, () => {
      test.use(use);

      test("Ctrl/⌘+K toggles the command palette and Enter runs a command", async ({
        page,
      }) => {
        await page.goto("/dashboard");
        await expect(
          page.getByRole("button", { name: "Search..." }),
        ).toHaveAttribute("aria-keyshortcuts", "Meta+K Control+K");

        const input = page.getByPlaceholder("Search tools, agents, pages...");
        await page.keyboard.press("Control+k");
        await expect(input).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(input).toBeHidden();

        await page.keyboard.press("Meta+k");
        await expect(input).toBeVisible();
        await page.keyboard.type("history");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/history$/);
      });
    });
  }

  test.describe("phone", () => {
    test.use(VIEWPORTS.phone.use);

    test("Escape closes the drawer, the chat and dialogs", async ({ page }) => {
      await page.goto("/credits");

      await menuButton(page).tap();
      await expect(mainNav(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(mainNav(page)).toBeHidden();

      await page.getByRole("button", { name: "Open chat" }).tap();
      const chat = page.getByRole("dialog", { name: "Chat" });
      await expect(chat).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(chat).toBeHidden();

      await page.getByRole("button", { name: "Buy More Credits" }).tap();
      const buy = page.getByRole("dialog", { name: "Buy Credits" });
      await expect(buy).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(buy).toBeHidden();
    });
  });
});
