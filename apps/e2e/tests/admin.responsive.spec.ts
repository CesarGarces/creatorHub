import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import {
  ADMIN_PAGES,
  adminApiRoutes,
  signInAdmin,
} from "../fixtures/admin-data";
import {
  VIEWPORTS,
  expectInsideViewport,
  expectInsideViewportX,
  expectNoHorizontalOverflow,
  expectTouchTarget,
  fontSizeOf,
  openVirtualKeyboard,
  snap,
} from "../fixtures/responsive";

/**
 * The admin panel on phones and tablets: drawer navigation (closed by
 * default), tables that become labelled cards, modals that fit the screen
 * with the on-screen keyboard open, and an unchanged desktop layout.
 */

const menuButton = (page: Page) =>
  page.getByRole("button", { name: "Open menu" });
const mainNav = (page: Page) =>
  page.getByRole("navigation", { name: "Main navigation" });

test.beforeEach(async ({ context, baseURL }) => {
  await mockApi(context, adminApiRoutes(), baseURL!);
  await signInAdmin(context, baseURL!);
});

for (const name of ["phone", "tablet"] as const) {
  const vp = VIEWPORTS[name];

  test.describe(`admin pages · ${vp.label}`, () => {
    test.use(vp.use);

    for (const spec of ADMIN_PAGES) {
      test(`${spec.path} fits the screen`, async ({ page }, testInfo) => {
        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();
        await expectNoHorizontalOverflow(page);

        await expectTouchTarget(menuButton(page));
        await expect(mainNav(page)).toBeHidden();
        // Content uses the full width (no docked sidebar).
        const heading = await spec.ready(page).boundingBox();
        expect(heading!.x).toBeLessThan(32);

        await snap(page, testInfo, `${name} ${spec.path}`);
      });
    }

    test("login fits, with 16px fields", async ({
      page,
      context,
    }, testInfo) => {
      await context.clearCookies();
      await page.goto("/login");
      await expect(
        page.getByRole("heading", { level: 1, name: "Admin Login" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
      const email = page.getByLabel("Email");
      expect(await fontSizeOf(email)).toBeGreaterThanOrEqual(16);
      await expectTouchTarget(page.getByRole("button", { name: "Sign In" }));
      await snap(page, testInfo, `${name} login`);
    });
  });
}

test.describe("admin navigation · phone", () => {
  test.use(VIEWPORTS.phone.use);

  test("the drawer opens, navigates, and closes (tap outside, Escape)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await expect(menuButton(page)).toHaveAttribute("aria-expanded", "false");
    await menuButton(page).tap();
    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeFocused();
    // Fully on screen once the slide-in transition has finished.
    const drawer = page.locator("#admin-sidebar");
    await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0);
    await expectInsideViewport(drawer);

    for (const label of [
      "Dashboard",
      "AI Models",
      "Voice (STT & TTS)",
      "Tools",
      "Modes",
      "Users",
      "Credit Plans",
      "Credit Emails",
      "Backups",
    ]) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expectTouchTarget(link);
    }
    await expectTouchTarget(page.getByRole("button", { name: "Logout" }));
    await expect(page.getByTestId("language-selector")).toBeVisible();
    await snap(page, testInfo, "admin drawer open");

    await nav.getByRole("link", { name: "Users", exact: true }).tap();
    await expect(page).toHaveURL(/\/users$/);
    await expect(mainNav(page)).toBeHidden();

    await menuButton(page).tap();
    await page.touchscreen.tap(370, 420);
    await expect(mainNav(page)).toBeHidden();

    await menuButton(page).tap();
    await page.keyboard.press("Escape");
    await expect(mainNav(page)).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });
});

test.describe("admin tables as cards · phone", () => {
  test.use(VIEWPORTS.phone.use);

  test("users: each row is a labelled card with visible actions", async ({
    page,
  }, testInfo) => {
    await page.goto("/users");
    const row = page.getByRole("row", { name: /Ana Creator/ });
    await expect(row).toBeVisible();
    await expectInsideViewportX(row);
    expect(await row.evaluate((el) => getComputedStyle(el).display)).toBe(
      "flex",
    );

    // Each value is introduced by its column name.
    const labels = await row
      .locator("td[data-label]")
      .evaluateAll((cells) =>
        cells.map((cell) =>
          getComputedStyle(cell, "::before").content.replace(/"/g, ""),
        ),
      );
    expect(labels).toEqual(["Role", "Plan", "Credits", "Status", "Actions"]);

    const edit = page.getByRole("button", { name: "Edit Ana Creator" });
    await expectInsideViewportX(edit);
    await expectTouchTarget(edit);
    await expect(edit).toContainText("Edit");
    const status = page.getByRole("switch", {
      name: "Active status of Ana Creator",
    });
    await expectInsideViewportX(status);
    await snap(page, testInfo, "users cards");

    // The confirmation dialog fits and its buttons are thumb-sized.
    await status.tap();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible();
    await expectInsideViewport(confirm);
    await expectTouchTarget(confirm.getByRole("button", { name: "Cancel" }));
    await confirm.getByRole("button", { name: "Cancel" }).tap();
    await expect(confirm).toBeHidden();
  });

  test("models: select-all stays available and row actions are reachable", async ({
    page,
  }, testInfo) => {
    await page.goto("/models");
    const selectAll = page.getByRole("checkbox", { name: "Select all models" });
    await expect(selectAll).toBeVisible();
    await selectAll.tap();
    await expect(page.getByText("3 selected")).toBeVisible();

    for (const label of [
      "Configure GPT-4o mini",
      "Configure FLUX.1 schnell",
      "Delete FLUX.1 schnell",
    ]) {
      const button = page.getByRole("button", { name: label });
      await expectInsideViewportX(button);
      await expectTouchTarget(button);
    }
    await expectNoHorizontalOverflow(page);
    await snap(page, testInfo, "models cards");
  });

  test("credit emails: trigger and log tables read as cards", async ({
    page,
  }) => {
    await page.goto("/credit-emails");
    const row = page.getByRole("row", { name: /50 credits/ }).first();
    await expect(row).toBeVisible();
    await expectTouchTarget(
      row.getByRole("button", { name: "Edit", exact: true }),
    );
    await expectTouchTarget(row.getByRole("button", { name: /Delete/ }));
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("admin modals and the on-screen keyboard · phone", () => {
  test.use(VIEWPORTS.phoneSmall.use);

  test("add model: the form scrolls inside the dialog, actions stay reachable", async ({
    page,
  }, testInfo) => {
    await page.goto("/models");
    await page.getByRole("button", { name: "Add model" }).tap();
    const dialog = page.getByRole("dialog", { name: "Add model" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);

    const modelId = dialog.getByLabel("Model ID");
    expect(await fontSizeOf(modelId)).toBeGreaterThanOrEqual(16);
    await modelId.tap();
    await openVirtualKeyboard(page, 300);
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box!.y + box!.height;
      })
      .toBeLessThanOrEqual(740 - 300 + 1);
    const submit = dialog.getByRole("button", { name: "Add model" });
    await expectInsideViewport(submit);
    await expectTouchTarget(submit);
    await snap(page, testInfo, "add model with keyboard");
  });

  test("credit plan form fits with the keyboard open", async ({
    page,
  }, testInfo) => {
    await page.goto("/credit-plans");
    await page.getByRole("button", { name: "Add Plan" }).tap();
    const dialog = page.getByRole("dialog", { name: "Create Credit Plan" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);
    await dialog.getByLabel("Name").tap();
    await openVirtualKeyboard(page, 300);
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box!.y + box!.height;
      })
      .toBeLessThanOrEqual(740 - 300 + 1);
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await cancel.scrollIntoViewIfNeeded();
    await expectInsideViewport(cancel);
    await expectTouchTarget(cancel);
    await snap(page, testInfo, "credit plan form with keyboard");
  });

  test("tool modes modal fits a small phone", async ({ page }) => {
    await page.goto("/tools");
    await page.getByRole("button", { name: "Modes" }).first().tap();
    const dialog = page.getByRole("dialog", { name: "Configure Modes" });
    await expect(dialog).toBeVisible();
    await expectInsideViewport(dialog);
    await expectTouchTarget(dialog.getByRole("button", { name: "Cancel" }));
  });
});

test.describe("admin · desktop 1280×800 (no regression)", () => {
  for (const spec of ADMIN_PAGES) {
    test(`${spec.path} keeps the docked sidebar`, async ({ page }) => {
      await page.goto(spec.path);
      await expect(spec.ready(page)).toBeVisible();
      await expect(mainNav(page)).toBeVisible();
      await expect(menuButton(page)).toBeHidden();
      expect((await page.locator("#admin-sidebar").boundingBox())!.width).toBe(
        256,
      );
      await expectNoHorizontalOverflow(page);
    });
  }
});
