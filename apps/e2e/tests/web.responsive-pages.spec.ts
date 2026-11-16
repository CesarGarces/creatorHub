import { expect, test } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { dismissCookieBanner, signInWeb } from "../fixtures/web-data";
import {
  PUBLIC_WEB_PAGES,
  WEB_PAGES,
  webPageRoutes,
} from "../fixtures/web-pages";
import {
  VIEWPORTS,
  expectInsideViewport,
  expectInsideViewportX,
  expectNoHorizontalOverflow,
  expectTouchTarget,
  snap,
} from "../fixtures/responsive";

/**
 * Every page of the web app on a phone and a tablet: it renders, nothing
 * scrolls sideways, the navigation and the top bar controls are reachable,
 * and a screenshot of each screen is kept in the report.
 */

for (const name of ["phone", "tablet"] as const) {
  const vp = VIEWPORTS[name];

  test.describe(`web pages · ${vp.label}`, () => {
    test.use(vp.use);

    for (const spec of WEB_PAGES) {
      test(`${spec.path} fits the screen`, async ({
        page,
        context,
        baseURL,
      }, testInfo) => {
        await mockApi(context, webPageRoutes, baseURL!);
        await signInWeb(context, baseURL!);
        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();

        await expectNoHorizontalOverflow(page);

        // Navigation: closed drawer, thumb-sized menu button.
        const menu = page.getByRole("button", { name: "Open menu" });
        await expectTouchTarget(menu);
        await expect(
          page.getByRole("navigation", { name: "Main navigation" }),
        ).toBeHidden();

        // Top bar controls are fully on screen.
        await expectInsideViewportX(
          page.getByRole("button", { name: "Open notifications" }),
        );
        // Credits: the short form on phones ("1,500 cr"), full on tablets.
        const credits = page
          .locator("header")
          .getByText(name === "phone" ? "1,500 cr" : "1,500 credits", {
            exact: true,
          })
          .locator("visible=true");
        await expect(credits).toHaveCount(1);
        await expectInsideViewportX(credits);

        // The assistant is one tap away.
        const chat = page.getByRole("button", { name: "Open chat" });
        await expectInsideViewport(chat);
        await expectTouchTarget(chat);

        await snap(page, testInfo, `${name} ${spec.path}`);
      });
    }

    for (const spec of PUBLIC_WEB_PAGES) {
      test(`${spec.path} (public) fits the screen`, async ({
        page,
        context,
        baseURL,
      }, testInfo) => {
        await mockApi(context, webPageRoutes, baseURL!);
        await dismissCookieBanner(context);
        await page.goto(spec.path);
        await expect(spec.ready(page)).toBeVisible();
        await expectNoHorizontalOverflow(page);
        await snap(page, testInfo, `${name} ${spec.path}`);
      });
    }

    test("sign-in: fields are 16px (no iOS zoom), card and buttons fit", async ({
      page,
      context,
      baseURL,
    }) => {
      await mockApi(context, webPageRoutes, baseURL!);
      await dismissCookieBanner(context);
      await page.goto("/login");

      const email = page.getByLabel("Email");
      const password = page.getByLabel("Password");
      for (const field of [email, password]) {
        await expectInsideViewportX(field);
        const size = await field.evaluate((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        );
        expect(size).toBeGreaterThanOrEqual(16);
      }
      const submit = page.getByRole("button", { name: "Sign in" });
      await expectInsideViewportX(submit);
      await expectTouchTarget(submit);
      // The language switcher does not cover the card.
      const switcher = page.getByTestId("language-selector");
      const card = page.getByRole("heading", { level: 1 });
      const [s, c] = await Promise.all([
        switcher.boundingBox(),
        card.boundingBox(),
      ]);
      expect(s!.y + s!.height).toBeLessThanOrEqual(c!.y);
    });

    test("cookie banner fits the screen and its buttons are tappable", async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      await mockApi(context, webPageRoutes, baseURL!);
      await page.goto("/login");
      const banner = page.getByRole("dialog", { name: /cookie/i });
      await expect(banner).toBeVisible();
      await expectInsideViewport(banner);
      const accept = banner.getByRole("button", { name: "Accept all" });
      await expectTouchTarget(accept);
      await snap(page, testInfo, `${name} cookie banner`);
      await accept.tap();
      await expect(banner).toBeHidden();
    });
  });
}

test.describe("web pages · desktop 1280×800 (no regression)", () => {
  for (const spec of WEB_PAGES) {
    test(`${spec.path} keeps the docked sidebar layout`, async ({
      page,
      context,
      baseURL,
    }) => {
      await mockApi(context, webPageRoutes, baseURL!);
      await signInWeb(context, baseURL!);
      await page.goto(spec.path);
      await expect(spec.ready(page)).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "Main navigation" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Open menu" }),
      ).toBeHidden();
      await expectNoHorizontalOverflow(page);
    });
  }
});
