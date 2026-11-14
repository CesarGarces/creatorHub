import { expect, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export type Lang = "en" | "es" | "pt";

export const LANG: Record<
  Lang,
  { name: string; intl: string; changed: string }
> = {
  en: {
    name: "English",
    intl: "en-US",
    changed: "Language changed to English",
  },
  es: {
    name: "Español",
    intl: "es-ES",
    changed: "Idioma cambiado a Español",
  },
  pt: {
    name: "Português",
    intl: "pt-BR",
    changed: "Idioma alterado para Português",
  },
};

/** Opens the language dropdown (the visible one) and picks a language. */
export async function openLanguageMenu(page: Page): Promise<void> {
  await page
    .getByTestId("language-selector")
    .locator("visible=true")
    .first()
    .click();
  await expect(page.getByRole("menu")).toBeVisible();
}

export async function chooseLanguage(page: Page, lang: Lang): Promise<void> {
  await openLanguageMenu(page);
  await page.getByTestId(`language-option-${lang}`).click();
}

/** The whole page reflects `lang`: `<html lang>` and the selector label. */
export async function expectLanguage(page: Page, lang: Lang): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("lang", LANG[lang].intl);
}

export async function expectLanguageToast(
  page: Page,
  lang: Lang,
): Promise<void> {
  await expect(page.locator("[data-sonner-toast]").first()).toContainText(
    LANG[lang].changed,
  );
}

export async function expectLocaleCookie(
  page: Page,
  lang: Lang,
): Promise<void> {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === "ch_locale");
  expect(cookie?.value).toBe(lang);
  // Remembered for future sessions (~1 year).
  expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(
    360 * 24 * 60 * 60 * 1000,
  );
}

/**
 * Screenshot of the current state, attached to the report and kept for the
 * A→B comparison image.
 */
export async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<Buffer> {
  // Let entrance animations and toasts settle.
  await page.waitForTimeout(400);
  const shot = await page.screenshot();
  await testInfo.attach(name, { body: shot, contentType: "image/png" });
  return shot;
}

/**
 * Builds a side-by-side "A → B" image (before / after switching language),
 * attaches it to the report and saves it under artifacts/a-to-b/.
 */
export async function saveAtoB(
  page: Page,
  testInfo: TestInfo,
  a: { label: string; shot: Buffer },
  b: { label: string; shot: Buffer },
): Promise<void> {
  const canvas = await page.context().newPage();
  await canvas.setViewportSize({ width: 1360, height: 520 });
  const img = (shot: Buffer) =>
    `data:image/png;base64,${shot.toString("base64")}`;
  await canvas.setContent(`
    <html><body style="margin:0;background:#05070d;font-family:system-ui,sans-serif;color:#f1f5f9">
      <div style="padding:14px 18px 6px;font-size:15px;font-weight:600">${testInfo.project.name} · ${testInfo.title}</div>
      <div style="display:flex;align-items:center;gap:14px;padding:8px 18px 18px">
        <figure style="margin:0;flex:1">
          <figcaption style="font-size:13px;margin-bottom:6px;color:#94a3b8">A — ${a.label}</figcaption>
          <img src="${img(a.shot)}" style="width:100%;border:1px solid #1e293b;border-radius:8px">
        </figure>
        <div style="font-size:34px;color:#00bbd9">→</div>
        <figure style="margin:0;flex:1">
          <figcaption style="font-size:13px;margin-bottom:6px;color:#94a3b8">B — ${b.label}</figcaption>
          <img src="${img(b.shot)}" style="width:100%;border:1px solid #1e293b;border-radius:8px">
        </figure>
      </div>
    </body></html>`);
  const composite = await canvas.screenshot({ fullPage: true });
  await canvas.close();

  await testInfo.attach("A-to-B", {
    body: composite,
    contentType: "image/png",
  });
  const slug = testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dir = path.join(
    __dirname,
    "..",
    "artifacts",
    "a-to-b",
    testInfo.project.name,
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${slug}.png`), composite);
}
