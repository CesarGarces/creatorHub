import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import api from "@/lib/api";
import * as cookie from "@/lib/cookie";
import { I18nProvider, changeLocale, useI18n } from "../i18n-provider";
import { __resetClientLocaleForTests, getClientLocale } from "../runtime";
import { applyAccountLocale } from "../account-sync";
import { LanguageOptions } from "@/components/i18n/language-selector";

vi.mock("@/lib/api", () => ({
  default: { patch: vi.fn().mockResolvedValue({}) },
  api: { patch: vi.fn().mockResolvedValue({}) },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function SettingsLabel() {
  const { t } = useI18n();
  return <h1>{t("settings.title")}</h1>;
}

function renderApp(initialLocale: "en" | "es" | "pt" = "en") {
  return render(
    <I18nProvider initialLocale={initialLocale}>
      <SettingsLabel />
      <LanguageOptions savedToAccount />
    </I18nProvider>,
  );
}

describe("switching the interface language", () => {
  beforeEach(() => {
    __resetClientLocaleForTests();
    vi.clearAllMocks();
    vi.spyOn(cookie, "getAccessToken").mockReturnValue(null);
    document.cookie =
      "ch_locale=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/";
  });

  it("renders in the server-resolved locale on first paint", () => {
    renderApp("pt");
    expect(screen.getByRole("heading").textContent).toBe("Configurações");
  });

  it("updates every translated text instantly when a language is picked", () => {
    renderApp("en");
    expect(screen.getByRole("heading").textContent).toBe("Settings");

    fireEvent.click(screen.getByTestId("language-card-es"));

    expect(screen.getByRole("heading").textContent).toBe("Configuración");
    expect(
      screen.getByTestId("language-card-es").getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByTestId("language-card-en").getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("confirms the change with a toast written in the new language", () => {
    renderApp("en");
    fireEvent.click(screen.getByTestId("language-card-pt"));
    expect(toast.success).toHaveBeenCalledWith(
      "Idioma alterado para Português",
      expect.objectContaining({ position: "top-center" }),
    );
  });

  it("remembers the choice for future sessions", () => {
    renderApp("en");
    fireEvent.click(screen.getByTestId("language-card-es"));
    expect(document.cookie).toContain("ch_locale=es");
    expect(document.documentElement.lang).toBe("es-ES");
  });

  it("does nothing when the current language is clicked again", () => {
    renderApp("es");
    fireEvent.click(screen.getByTestId("language-card-es"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("saves the choice to the account when signed in", async () => {
    vi.mocked(cookie.getAccessToken).mockReturnValue("token");
    renderApp("en");
    fireEvent.click(screen.getByTestId("language-card-pt"));
    expect(api.patch).toHaveBeenCalledWith("/auth/preferences", {
      preferredLanguage: "pt",
    });
  });

  it("keeps the local change even if saving to the account fails", async () => {
    vi.mocked(cookie.getAccessToken).mockReturnValue("token");
    vi.mocked(api.patch).mockRejectedValueOnce(new Error("offline"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderApp("en");

    await act(async () => {
      fireEvent.click(screen.getByTestId("language-card-es"));
    });

    expect(screen.getByRole("heading").textContent).toBe("Configuración");
    expect(getClientLocale()).toBe("es");
    warn.mockRestore();
  });

  it("reacts to changes made outside React (e.g. after sign-in)", () => {
    renderApp("en");
    act(() => {
      changeLocale("pt");
    });
    expect(screen.getByRole("heading").textContent).toBe("Configurações");
  });
});

describe("account language on sign-in", () => {
  beforeEach(() => {
    __resetClientLocaleForTests();
    vi.clearAllMocks();
  });

  it("applies the language saved on the account", () => {
    render(
      <I18nProvider initialLocale="en">
        <SettingsLabel />
      </I18nProvider>,
    );
    act(() => applyAccountLocale("es"));
    expect(screen.getByRole("heading").textContent).toBe("Configuración");
  });

  it("stores the current language when the account has none yet", () => {
    vi.spyOn(cookie, "getAccessToken").mockReturnValue("token");
    render(
      <I18nProvider initialLocale="pt">
        <SettingsLabel />
      </I18nProvider>,
    );
    applyAccountLocale(null);
    expect(api.patch).toHaveBeenCalledWith("/auth/preferences", {
      preferredLanguage: "pt",
    });
    expect(getClientLocale()).toBe("pt");
  });

  it("ignores unsupported values from the server", () => {
    vi.spyOn(cookie, "getAccessToken").mockReturnValue(null);
    render(
      <I18nProvider initialLocale="en">
        <SettingsLabel />
      </I18nProvider>,
    );
    act(() => applyAccountLocale("klingon"));
    expect(getClientLocale()).toBe("en");
  });
});
