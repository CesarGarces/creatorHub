import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { expectAccessible } from "../fixtures/a11y";
import {
  ADMIN_PAGES,
  adminApiRoutes,
  signInAdmin,
} from "../fixtures/admin-data";
import { VIEWPORTS } from "../fixtures/responsive";

/**
 * Automated accessibility audit (axe-core) of every admin panel page, on a
 * phone and on a desktop, plus its drawer, modals and confirmations.
 *
 * Gate: zero colour-contrast violations, zero missing accessible names /
 * labels, zero `critical` violations (see fixtures/a11y.ts).
 */

const SCREENS = [
  ["phone", VIEWPORTS.phone.use],
  ["desktop", { viewport: { width: 1280, height: 800 } }],
] as const;

test.beforeEach(async ({ context, baseURL }) => {
  await mockApi(context, adminApiRoutes(), baseURL!);
  await signInAdmin(context, baseURL!);
});

for (const [screen, use] of SCREENS) {
  test.describe(`admin a11y · ${screen}`, () => {
    test.use(use);

    for (const spec of ADMIN_PAGES) {
      test(`${spec.path}`, async ({ page }, testInfo) => {
        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();
        await expectAccessible(page, testInfo, `${screen} ${spec.path}`);
      });
    }

    test("/login", async ({ page, context }, testInfo) => {
      await context.clearCookies();
      await page.goto("/login");
      await expect(
        page.getByRole("heading", { level: 1, name: "Admin Login" }),
      ).toBeVisible();
      await expectAccessible(page, testInfo, `${screen} /login`);
    });
  });
}

test.describe("admin a11y · opened screens · phone", () => {
  test.use(VIEWPORTS.phone.use);

  const check = (page: Page, info: TestInfo, name: string) =>
    expectAccessible(page, info, `phone ${name}`);

  test("navigation drawer", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).tap();
    const drawer = page.locator("#admin-sidebar");
    await expect.poll(async () => (await drawer.boundingBox())!.x).toBe(0);
    await check(page, testInfo, "admin drawer");
  });

  test("users: status confirmation", async ({ page }, testInfo) => {
    await page.goto("/users");
    await page
      .getByRole("switch", { name: "Active status of Ana Creator" })
      .tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, testInfo, "user status confirmation");
  });

  test("models: add model and delete confirmation", async ({
    page,
  }, testInfo) => {
    await page.goto("/models");
    await page.getByRole("button", { name: "Add model" }).tap();
    await expect(page.getByRole("dialog", { name: "Add model" })).toBeVisible();
    await check(page, testInfo, "add model dialog");

    await page.goto("/models");
    await page.getByRole("button", { name: "Configure GPT-4o mini" }).tap();
    await expect(
      page.getByRole("dialog").getByText("Fast, low-cost general model."),
    ).toBeVisible();
    await check(page, testInfo, "model detail dialog");

    await page.goto("/models");
    await page.getByRole("button", { name: "Delete FLUX.1 schnell" }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await check(page, testInfo, "delete model confirmation");
  });

  test("credit plans: create plan dialog", async ({ page }, testInfo) => {
    await page.goto("/credit-plans");
    await page.getByRole("button", { name: "Add Plan" }).tap();
    await expect(
      page.getByRole("dialog", { name: "Create Credit Plan" }),
    ).toBeVisible();
    await check(page, testInfo, "credit plan dialog");
  });

  test("tools: modes dialog", async ({ page }, testInfo) => {
    await page.goto("/tools");
    await page.getByRole("button", { name: "Modes" }).first().tap();
    await expect(
      page.getByRole("dialog", { name: "Configure Modes" }),
    ).toBeVisible();
    await check(page, testInfo, "tool modes dialog");
  });
});
