import { expect, test } from "@playwright/test";
import {
  capture,
  chooseLanguage,
  expectLanguage,
  expectLanguageToast,
  expectLocaleCookie,
  openLanguageMenu,
  saveAtoB,
} from "../fixtures/i18n";

test.describe("landing page · language switcher", () => {
  test("navbar dropdown switches English → Spanish across every section", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText("One Workspace. Infinite Content.");
    await expectLanguage(page, "en");
    const a = await capture(page, testInfo, "A-english");

    await openLanguageMenu(page);
    await capture(page, testInfo, "menu-open");
    await page.getByTestId("language-option-es").click();

    await expect(h1).toHaveText("Un espacio de trabajo. Contenido infinito.");
    await expectLanguage(page, "es");
    await expectLanguageToast(page, "es");
    const b = await capture(page, testInfo, "B-spanish");
    await saveAtoB(
      page,
      testInfo,
      { label: "English", shot: a },
      { label: "Español", shot: b },
    );

    // Navigation, CTAs and every section below the fold.
    const nav = page.getByRole("navigation");
    await expect(nav.getByRole("link", { name: "Herramientas" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Iniciar sesión" }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: "Registrarse" })).toBeVisible();
    for (const heading of [
      "De la idea al contenido en segundos",
      "Herramientas reales para creadores reales",
      "Tu equipo de contenido con IA",
      "Miniaturas que consiguen clics",
      "Sistema de créditos flexible",
      "Preguntas frecuentes",
    ]) {
      await expect(page.getByRole("heading", { name: heading })).toBeAttached();
    }
    await expect(page.getByText("Costo por herramienta")).toBeAttached();
    await expect(
      page.getByText("© 2026 Creator Hub. Todos los derechos reservados."),
    ).toBeAttached();

    // Nothing left in English from the original page.
    const body = await page.locator("body").innerText();
    for (const english of [
      "Real tools for real creators",
      "Your AI content team",
      "Flexible credit system",
      "Most Popular",
      "All rights reserved",
    ]) {
      expect(body).not.toContain(english);
    }

    // FAQ answers render in Spanish too.
    await page.getByRole("button", { name: "¿Qué es Creator Hub?" }).click();
    await expect(
      page.getByText(/^Creator Hub es una plataforma con IA/),
    ).toBeVisible();

    await expectLocaleCookie(page, "es");
    await page.reload();
    await expect(h1).toHaveText("Un espacio de trabajo. Contenido infinito.");
  });

  test.describe("on a phone", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test("compact selector next to the menu switches English → Portuguese", async ({
      page,
    }, testInfo) => {
      await page.goto("/");
      const selector = page
        .getByTestId("language-selector")
        .locator("visible=true");
      await expect(selector).toHaveCount(1);
      await expect(selector).toContainText("EN");
      const a = await capture(page, testInfo, "A-english");

      await chooseLanguage(page, "pt");

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Um espaço de trabalho. Conteúdo infinito.",
      );
      await expect(selector).toContainText("PT");
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await expect(
        page.getByRole("link", { name: "Ferramentas" }).last(),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Cadastre-se" }).last(),
      ).toBeVisible();
      const b = await capture(page, testInfo, "B-portuguese");
      await saveAtoB(
        page,
        testInfo,
        { label: "English", shot: a },
        { label: "Português", shot: b },
      );
    });
  });
});
