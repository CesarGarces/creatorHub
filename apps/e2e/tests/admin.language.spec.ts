import { expect, test, type BrowserContext } from "@playwright/test";
import { fakeJwt, mockApi } from "../fixtures/api-mock";
import {
  capture,
  chooseLanguage,
  expectLanguage,
  expectLanguageToast,
  expectLocaleCookie,
  openLanguageMenu,
  saveAtoB,
} from "../fixtures/i18n";

const ADMIN_TOKEN = fakeJwt({
  sub: "admin-1",
  email: "admin@local",
  role: "ADMIN",
});

const adminRoutes = (preferredLanguage: string | null) => ({
  "POST /admin/login": {
    data: {
      accessToken: ADMIN_TOKEN,
      user: {
        id: "admin-1",
        email: "admin@local",
        role: "ADMIN",
        preferredLanguage,
      },
    },
  },
  "PATCH /auth/preferences": ({ body }: { body: unknown }) => body,
  "/admin/dashboard/stats": {
    totalUsers: 1250,
    activeUsers: 1100,
    inactiveUsers: 150,
    totalProviders: 4,
    activeProviders: 3,
    totalCreditsUsed: 48200,
    totalCreditsRemaining: 91000,
    totalFavorites: 320,
  },
  "/admin/dashboard/usage": {
    byProvider: [
      { toolId: "thumbnail-generator", usageCount: 40, credits: 400 },
    ],
  },
  "/admin/dashboard/favorites": {
    byTool: [{ toolId: "video-generator", favoriteCount: 12 }],
  },
  "/admin/dashboard/top-users": {
    users: [
      {
        userId: "u1",
        userName: "Ana",
        userEmail: "ana@example.com",
        userPlan: "FREE",
        usageCount: 12,
        creditsUsed: 1500,
      },
    ],
  },
  "/admin/dashboard/registrations": { byDay: [] },
  "/admin/users": {
    data: [
      {
        id: "u1",
        email: "ana@example.com",
        name: "Ana",
        role: "USER",
        plan: "PAY_AS_YOU_GO",
        currentCredits: 80,
        purchasedCredits: 1000,
        totalCredits: 1080,
        isActive: true,
        createdAt: "2026-10-01T00:00:00Z",
        lastLoginAt: null,
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  },
});

async function signInAdmin(context: BrowserContext, baseURL: string) {
  await context.addCookies([
    { name: "admin_token", value: ADMIN_TOKEN, url: baseURL },
  ]);
  await context.addInitScript(
    (token) => localStorage.setItem("admin_token", token),
    ADMIN_TOKEN,
  );
}

test.describe("admin panel · language switcher", () => {
  test("login screen switches English → Portuguese", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Admin Login",
    );
    const a = await capture(page, testInfo, "A-english");

    await openLanguageMenu(page);
    await page.getByTestId("language-option-pt").click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Login de administração",
    );
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByLabel("Senha")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expectLanguage(page, "pt");
    await expectLanguageToast(page, "pt");
    const b = await capture(page, testInfo, "B-portuguese");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Português", shot: b },
    );
    await expectLocaleCookie(page, "pt");
  });

  test("signing in applies the admin's saved language", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await mockApi(context, adminRoutes("es"), baseURL!);

    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@local");
    await page.getByLabel("Password").fill("secret123");
    const a = await capture(page, testInfo, "A-english-login");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Panel");
    await expect(page.getByText("Resumen de tu plataforma")).toBeVisible();
    await expect(page.getByText("Usuarios totales")).toBeVisible();
    await expect(page.getByText("1100 activos")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Modelos de IA" }),
    ).toBeVisible();
    await expectLanguageToast(page, "es");
    await expectLanguage(page, "es");
    const b = await capture(page, testInfo, "B-account-language");
    await saveAtoB(
      page,
      testInfo,
      { label: "English (browser)", shot: a },
      { label: "Español (saved on the account)", shot: b },
    );
  });

  test("sidebar switcher changes the whole panel and saves it to the account", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const api = await mockApi(context, adminRoutes(null), baseURL!);
    await signInAdmin(context, baseURL!);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Dashboard",
    );
    await expect(page.getByText("Total Users")).toBeVisible();
    const a = await capture(page, testInfo, "A-english");

    await chooseLanguage(page, "es");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Panel");
    await expect(page.getByText("Usuarios totales")).toBeVisible();
    await expect(page.getByText("48.200")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Copias de seguridad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cerrar sesión" }),
    ).toBeVisible();
    await expectLanguageToast(page, "es");
    const b = await capture(page, testInfo, "B-spanish");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Español", shot: b },
    );

    await expect
      .poll(() => api.calls("PATCH", "/auth/preferences").map((c) => c.body))
      .toContainEqual({ preferredLanguage: "es" });
  });

  test("users table and confirmation dialog follow the selected language", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await mockApi(context, adminRoutes(null), baseURL!);
    await signInAdmin(context, baseURL!);

    await page.goto("/users");
    const header = page.locator("thead");
    await expect(header).toContainText("Actions");
    const a = await capture(page, testInfo, "A-english");

    await chooseLanguage(page, "es");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Usuarios",
    );
    await expect(header).toContainText("Acciones");
    await expect(header).not.toContainText("Actions");
    await expect(page.getByText("PAGO POR USO")).toBeVisible();
    await expect(
      page.getByText("(80 disponibles, 1000 comprados)"),
    ).toBeVisible();

    await page.getByRole("switch", { name: "Estado activo de Ana" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Desactivar usuario");
    await expect(dialog).toContainText(
      '¿Seguro que quieres desactivar a "Ana"?',
    );
    await expect(
      dialog.getByRole("button", { name: "Cancelar" }),
    ).toBeVisible();
    const b = await capture(page, testInfo, "B-spanish-dialog");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Español", shot: b },
    );
  });
});
