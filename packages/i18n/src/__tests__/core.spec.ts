import { describe, expect, it } from "vitest";
import {
  buildLocaleCookie,
  createTranslator,
  findDictionaryIssues,
  isLocale,
  matchAcceptLanguage,
  resolveRequestLocale,
  type KeyOf,
} from "../index";
import { languageChangedMessage, PACKAGE_MESSAGES } from "../package-messages";

const en = {
  greeting: "Hello, {name}",
  items_one: "{count} item",
  items_other: "{count} items",
  onlyEnglish: "Fallback text",
  nested: { title: "Title" },
};
type Messages = typeof en;
const es: Messages = {
  greeting: "Hola, {name}",
  items_one: "{count} artículo",
  items_other: "{count} artículos",
  onlyEnglish: "",
  nested: { title: "Título" },
};
const pt: Messages = {
  ...es,
  greeting: "Olá, {name}",
  nested: { title: "Título" },
};

const translator = createTranslator<Messages>({ en, es, pt });

describe("createTranslator", () => {
  it("translates and interpolates per locale", () => {
    expect(translator.translate("es", "greeting", { name: "Ana" })).toBe(
      "Hola, Ana",
    );
    expect(translator.translate("en", "nested.title")).toBe("Title");
  });

  it("picks plural forms and formats numbers for the locale", () => {
    expect(translator.translate("en", "items", { count: 1 })).toBe("1 item");
    expect(translator.translate("en", "items", { count: 1200 })).toBe(
      "1,200 items",
    );
    expect(translator.translate("pt", "items", { count: 1200 })).toBe(
      "1.200 artículos",
    );
  });

  it("falls back to English, then to the key", () => {
    const { translate } = createTranslator<Messages>({
      en,
      es: { ...es, nested: {} as Messages["nested"] },
      pt,
    });
    expect(translate("es", "nested.title")).toBe("Title");
    expect(translate("es", "missing" as KeyOf<Messages>)).toBe("missing");
  });

  it("supports optional data-driven keys", () => {
    expect(translator.translateOptional("es", "nested.title", "x")).toBe(
      "Título",
    );
    expect(
      translator.translateOptional("es", "tools.unknown", "API name"),
    ).toBe("API name");
    expect(translator.hasTranslation("es", "tools.unknown")).toBe(false);
  });
});

describe("locale negotiation", () => {
  it("validates locales", () => {
    expect(isLocale("pt")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("matches Accept-Language by quality", () => {
    expect(matchAcceptLanguage("es-AR,es;q=0.9,en;q=0.8")).toBe("es");
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9,pt;q=0.5")).toBe("pt");
    expect(matchAcceptLanguage("de")).toBe("en");
    expect(matchAcceptLanguage(undefined)).toBe("en");
  });

  it("prefers the saved choice over the browser language", () => {
    expect(resolveRequestLocale("pt", "es-ES")).toBe("pt");
    expect(resolveRequestLocale("xx", "es-ES")).toBe("es");
    expect(resolveRequestLocale(undefined, null)).toBe("en");
  });
});

describe("preference cookie", () => {
  it("lasts a year and is readable by every page of the site", () => {
    const cookie = buildLocaleCookie("es");
    expect(cookie).toMatch(/^ch_locale=es; Expires=/);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Domain=");
    const expires = new Date(cookie.match(/Expires=([^;]+)/)![1]!).getTime();
    expect(expires - Date.now()).toBeGreaterThan(360 * 86_400_000);
  });

  it("can be shared across subdomains and marked secure", () => {
    const cookie = buildLocaleCookie("pt", {
      domain: ".creatorhubplatform.com",
      secure: true,
    });
    expect(cookie).toContain("Domain=.creatorhubplatform.com");
    expect(cookie).toContain("Secure");
  });
});

describe("findDictionaryIssues", () => {
  it("reports missing keys, empty strings and broken placeholders", () => {
    const issues = findDictionaryIssues<Messages>({
      en,
      es,
      pt: { ...pt, greeting: "Olá, {nome}" },
    });
    expect(issues).toContain('es: empty "onlyEnglish"');
    expect(issues).toContain('pt: placeholders differ in "greeting"');
  });

  it("is happy with consistent dictionaries", () => {
    expect(
      findDictionaryIssues({
        en,
        es: { ...es, onlyEnglish: "x" },
        pt: { ...pt, onlyEnglish: "x" },
      }),
    ).toEqual([]);
  });

  it("keeps the package's own strings consistent", () => {
    expect(findDictionaryIssues(PACKAGE_MESSAGES)).toEqual([]);
  });
});

describe("languageChangedMessage", () => {
  it("is written in the newly selected language", () => {
    expect(languageChangedMessage("en")).toBe("Language changed to English");
    expect(languageChangedMessage("es")).toBe("Idioma cambiado a Español");
    expect(languageChangedMessage("pt")).toBe("Idioma alterado para Português");
  });
});
