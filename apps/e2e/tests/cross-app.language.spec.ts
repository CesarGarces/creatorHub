import { expect, test } from "@playwright/test";
import { URLS } from "../playwright.config";
import {
  capture,
  chooseLanguage,
  expectLanguage,
  saveAtoB,
} from "../fixtures/i18n";

/**
 * The landing page and the app share the `ch_locale` cookie (on localhost
 * cookies are shared across ports; in production via
 * NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN), so the choice carries over.
 */
test("the language chosen on the landing page carries into the app, and back", async ({
  page,
}, testInfo) => {
  await page.goto(URLS.landing);
  await chooseLanguage(page, "es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Un espacio de trabajo. Contenido infinito.",
  );
  const a = await capture(page, testInfo, "A-landing-spanish");

  // Visitor clicks through to sign up: the app opens in Spanish.
  await page.goto(`${URLS.web}/register`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Crea tu cuenta",
  );
  await expectLanguage(page, "es");
  const b = await capture(page, testInfo, "B-app-spanish");
  await saveAtoB(
    page,
    testInfo,
    { label: "Landing · Español chosen", shot: a },
    { label: "App · opens in Español", shot: b },
  );

  // Changing it in the app updates the landing page too.
  await chooseLanguage(page, "pt");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Crie sua conta",
  );
  await page.goto(URLS.landing);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Um espaço de trabalho. Conteúdo infinito.",
  );
});
