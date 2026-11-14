import { beforeEach, describe, expect, it, vi } from "vitest";

// The locale runtime only activates in a browser. Stub `window` *before*
// loading any i18n module (static imports would be evaluated first).
vi.stubGlobal("window", {});
const { __resetClientLocaleForTests, findDictionaryIssues, initClientLocale } =
  await import("@creator-hub/i18n");
const { getMessages, translate } = await import("../translate");
const { localizeError } = await import("../errors");

const apiError = (message: unknown) => ({
  isAxiosError: true,
  response: { status: 400, data: { message } },
});

describe("admin dictionaries", () => {
  it("every language has the same keys, placeholders and tags as English", () => {
    expect(
      findDictionaryIssues({
        en: getMessages("en"),
        es: getMessages("es"),
        pt: getMessages("pt"),
      }),
    ).toEqual([]);
  });

  it("pluralizes counts", () => {
    expect(translate("en", "models.toasts.bulkActivated", { count: 1 })).toBe(
      "1 model activated",
    );
    expect(translate("es", "models.toasts.bulkActivated", { count: 3 })).toBe(
      "3 modelos activados",
    );
  });
});

describe("localizeError", () => {
  beforeEach(() => {
    __resetClientLocaleForTests();
    initClientLocale("es");
  });

  it("translates known admin API messages", () => {
    expect(
      localizeError(apiError("Cannot deactivate the last active admin")),
    ).toBe("No puedes desactivar al último administrador activo");
    expect(
      localizeError(apiError('Credit plan with slug "PRO" already exists')),
    ).toBe('Ya existe un plan de créditos con el slug "PRO"');
    expect(localizeError(apiError("Mode not found"))).toBe(
      "No se encontró el elemento",
    );
  });

  it("uses the first validation message and keeps unknown ones", () => {
    expect(localizeError(apiError(["slug must be a string"]))).toBe(
      "slug must be a string",
    );
  });

  it("falls back to the caller's message or a network error", () => {
    expect(localizeError({}, "modes.toasts.deleteFailed")).toBe(
      "No se pudo eliminar el modo",
    );
    expect(localizeError({ isAxiosError: true })).toBe(
      "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
    );
  });
});
