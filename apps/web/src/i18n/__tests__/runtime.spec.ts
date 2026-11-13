import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetClientLocaleForTests,
  getClientLocale,
  initClientLocale,
  setClientLocale,
  subscribeToLocale,
  t,
} from "../runtime";
import { LOCALE_COOKIE } from "../config";

function clearCookies() {
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0]?.trim();
    if (name)
      document.cookie = `${name}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`;
  });
}

describe("client locale runtime", () => {
  beforeEach(() => {
    __resetClientLocaleForTests();
    clearCookies();
    document.documentElement.lang = "en-US";
  });
  afterEach(() => clearCookies());

  it("is seeded once with the server-resolved locale", () => {
    initClientLocale("pt");
    initClientLocale("es"); // ignored: already initialized
    expect(getClientLocale()).toBe("pt");
    expect(t("nav.history")).toBe("Histórico");
  });

  it("switching persists the choice in a cookie for future sessions", () => {
    initClientLocale("en");
    setClientLocale("es");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=es`);
  });

  it("switching updates <html lang> and notifies subscribers immediately", () => {
    initClientLocale("en");
    const listener = vi.fn();
    subscribeToLocale(listener);

    expect(setClientLocale("es")).toBe(true);

    expect(document.documentElement.lang).toBe("es-ES");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(t("nav.tools")).toBe("Herramientas");
  });

  it("re-selecting the current locale is a no-op for listeners", () => {
    initClientLocale("es");
    const listener = vi.fn();
    subscribeToLocale(listener);

    expect(setClientLocale("es")).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
