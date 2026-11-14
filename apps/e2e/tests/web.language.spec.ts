import { expect, test } from "@playwright/test";
import { mockApi } from "../fixtures/api-mock";
import {
  capture,
  chooseLanguage,
  expectLanguage,
  expectLanguageToast,
  expectLocaleCookie,
  openLanguageMenu,
  saveAtoB,
} from "../fixtures/i18n";
import {
  dismissCookieBanner,
  signInWeb,
  webApiRoutes,
} from "../fixtures/web-data";

test.describe("web app · language switcher", () => {
  test("sign-in screen switches English → Spanish and remembers it", async ({
    page,
  }, testInfo) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome to Creator Hub",
    );
    await expectLanguage(page, "en");
    const a = await capture(page, testInfo, "A-english");

    await openLanguageMenu(page);
    await capture(page, testInfo, "menu-open");
    await page.getByTestId("language-option-es").click();

    // Instant, no reload: every text on the screen is now Spanish.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bienvenido a Creator Hub",
    );
    await expect(page.getByText("Inicia sesión en tu cuenta")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(page.getByText("¿Olvidaste tu contraseña?")).toBeVisible();
    // The cookie banner is a shared component — translated too.
    await expect(
      page.getByRole("button", { name: "Aceptar todo" }),
    ).toBeVisible();
    await expectLanguage(page, "es");
    await expectLanguageToast(page, "es");
    const b = await capture(page, testInfo, "B-spanish");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Español", shot: b },
    );

    // Kept for future sessions: cookie + server-rendered Spanish on reload.
    await expectLocaleCookie(page, "es");
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bienvenido a Creator Hub",
    );
  });

  test.describe("with a Portuguese browser", () => {
    test.use({ locale: "pt-BR" });

    test("first visit follows the browser language", async ({
      page,
    }, testInfo) => {
      await page.goto("/register");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Crie sua conta",
      );
      await expectLanguage(page, "pt");
      await expect(page.getByTestId("language-selector")).toContainText(
        "Português",
      );
      await capture(page, testInfo, "portuguese-browser");
    });
  });

  test("signed-in app: top bar switcher translates everything and saves it to the account", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const api = await mockApi(context, webApiRoutes, baseURL!);
    await signInWeb(context, baseURL!);

    await page.goto("/dashboard");
    await expect(
      page.getByText(/^Good (morning|afternoon|evening), Ana/),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
    const a = await capture(page, testInfo, "A-english");

    await chooseLanguage(page, "pt");

    await expect(
      page.getByText(/^(Bom dia|Boa tarde|Boa noite), Ana/),
    ).toBeVisible();
    await expect(page.getByText("O que você vai criar hoje?")).toBeVisible();
    // Sidebar, tools from the API (localized by ID), numbers and activity.
    await expect(
      page.getByRole("link", { name: "Configurações" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Ferramentas" })).toBeVisible();
    await expect(page.getByText("Gerador de thumbnails")).toBeVisible();
    await expect(page.getByText("1.500 créditos")).toBeVisible();
    await expect(page.getByText("Atividade recente")).toBeVisible();
    await expectLanguage(page, "pt");
    await expectLanguageToast(page, "pt");
    const b = await capture(page, testInfo, "B-portuguese");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Português", shot: b },
    );

    // Saved to the account so it follows the user to other devices.
    await expect
      .poll(() => api.calls("PATCH", "/auth/preferences").map((c) => c.body))
      .toContainEqual({ preferredLanguage: "pt" });
  });

  test("settings page: language cards switch instantly and persist after reload", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await mockApi(context, webApiRoutes, baseURL!);
    await signInWeb(context, baseURL!);

    await page.goto("/settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Settings",
    );
    await expect(page.getByTestId("language-card-en")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByTestId("language-card-es").scrollIntoViewIfNeeded();
    const a = await capture(page, testInfo, "A-english");

    await page.getByTestId("language-card-es").click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Configuración",
    );
    await expect(page.getByTestId("language-card-es")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(
      page.getByText("Guardado en tu cuenta y en este dispositivo"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Cambiar contraseña" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Zona de peligro" }),
    ).toBeVisible();
    const b = await capture(page, testInfo, "B-spanish");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Español", shot: b },
    );

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Configuración",
    );
    await expectLanguage(page, "es");
  });

  test("sign-in restores the language saved on the account", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    await dismissCookieBanner(context);
    await mockApi(
      context,
      {
        ...webApiRoutes,
        "POST /auth/login": {
          accessToken: "e2e-access",
          refreshToken: "e2e-refresh",
          emailVerified: true,
          user: {
            id: "u1",
            email: "ana@example.com",
            role: "USER",
            name: "Ana",
            preferredLanguage: "es",
          },
        },
      },
      baseURL!,
    );

    await page.goto("/login");
    await page.getByLabel("Email").fill("ana@example.com");
    await page.getByLabel("Password").fill("password123");
    const a = await capture(page, testInfo, "A-english-login");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      page.getByText(/^(Buenos días|Buenas tardes|Buenas noches), Ana/),
    ).toBeVisible();
    // The switch is explained, in the new language.
    await expectLanguageToast(page, "es");
    await expectLanguage(page, "es");
    const b = await capture(page, testInfo, "B-account-language");
    await saveAtoB(
      page,
      testInfo,
      { label: "English (browser)", shot: a },
      { label: "Español (saved on the account)", shot: b },
    );
    await expectLocaleCookie(page, "es");
  });
});
