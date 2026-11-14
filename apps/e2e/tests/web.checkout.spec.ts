import { expect, test } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import { capture } from "../fixtures/i18n";
import { dismissCookieBanner, webApiRoutes } from "../fixtures/web-data";

/**
 * Port of the former Cypress checkout spec (apps/web/e2e/specs), updated to
 * the current app: the login response marks the email as verified, and the
 * credits page's plan cards use "Buy Credits".
 */
test("checkout: sign in, keep the session and start a plan checkout", async ({
  page,
  context,
  baseURL,
}, testInfo) => {
  await dismissCookieBanner(context);
  const api = await mockApi(
    context,
    {
      ...webApiRoutes,
      "POST /auth/login": {
        accessToken: "access-123",
        refreshToken: "refresh-abc",
        emailVerified: true,
        user: { id: "u1", email: "test@local", role: "USER" },
      },
      "POST /credits/checkout": {
        preferenceId: "pref_123",
        gatewayTxId: "tx123",
      },
    },
    baseURL!,
  );

  await page.goto("/login");
  await page.getByLabel("Email").fill("test@local");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The session is kept: user in sessionStorage, refresh token in a cookie.
  expect(
    await page.evaluate(() => sessionStorage.getItem("ch_user")),
  ).not.toBeNull();
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "ch_refresh_token")?.value).toBe(
    "refresh-abc",
  );

  await page.goto("/credits");
  await expect(page.getByText("Credit Plans")).toBeVisible();
  await page
    .getByRole("button", { name: "Buy Credits", exact: true })
    .first()
    .click();

  await expect
    .poll(() => api.calls("POST", "/credits/checkout").map((c) => c.body))
    .toContainEqual({ planId: "plan_starter" });
  await expect(page.getByText("Selected Plan")).toBeVisible();
  await capture(page, testInfo, "checkout-modal");
});
