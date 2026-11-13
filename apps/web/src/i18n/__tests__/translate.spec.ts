import { describe, expect, it } from "vitest";
import { isLocale, matchAcceptLanguage } from "../config";
import { hasTranslation, translate, type TranslationKey } from "../translate";

describe("translate", () => {
  it("returns the text for the requested locale", () => {
    expect(translate("en", "nav.settings")).toBe("Settings");
    expect(translate("es", "nav.settings")).toBe("Configuración");
    expect(translate("pt", "nav.settings")).toBe("Configurações");
  });

  it("interpolates parameters", () => {
    expect(translate("en", "language.changed", { language: "Español" })).toBe(
      "Language changed to Español",
    );
  });

  it("formats numeric parameters for the locale", () => {
    expect(translate("en", "credits.planCredits", { count: 1500 })).toBe(
      "1,500 credits",
    );
    expect(translate("pt", "credits.planCredits", { count: 1500 })).toBe(
      "1.500 créditos",
    );
  });

  it("picks the plural form from the count", () => {
    expect(translate("en", "common.credits.count", { count: 1 })).toBe(
      "1 credit",
    );
    expect(translate("en", "common.credits.count", { count: 5 })).toBe(
      "5 credits",
    );
    expect(translate("es", "common.credits.count", { count: 1 })).toBe(
      "1 crédito",
    );
    expect(translate("es", "common.credits.count", { count: 0 })).toBe(
      "0 créditos",
    );
  });

  it("returns the key for unknown keys instead of blank UI", () => {
    const key = "does.not.exist" as TranslationKey;
    expect(translate("es", key)).toBe("does.not.exist");
    expect(hasTranslation("es", "does.not.exist")).toBe(false);
    expect(hasTranslation("es", "nav.tools")).toBe(true);
  });
});

describe("locale negotiation", () => {
  it("validates supported locales", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("matches the best supported Accept-Language entry", () => {
    expect(matchAcceptLanguage("es-AR,es;q=0.9,en;q=0.8")).toBe("es");
    expect(matchAcceptLanguage("pt-BR")).toBe("pt");
    expect(matchAcceptLanguage("fr-FR,fr;q=0.9,pt;q=0.5")).toBe("pt");
    expect(matchAcceptLanguage("en;q=0.2,es;q=0.8")).toBe("es");
  });

  it("falls back to English", () => {
    expect(matchAcceptLanguage(null)).toBe("en");
    expect(matchAcceptLanguage("de-DE,fr;q=0.8")).toBe("en");
    expect(matchAcceptLanguage("es;q=0")).toBe("en");
  });
});
