/**
 * Strings owned by the package itself (language selector, relative time),
 * so every app shows identical wording without duplicating translations.
 */
import { LOCALE_META, type Locale } from "./config";
import { interpolate } from "./core";

export interface PackageMessages {
  label: string;
  /** `{language}` is the current language's native name. */
  selectorAriaLabel: string;
  menuTitle: string;
  current: string;
  /** Shown in the *new* language right after switching. */
  changed: string;
  justNow: string;
}

export const PACKAGE_MESSAGES: Record<Locale, PackageMessages> = {
  en: {
    label: "Language",
    selectorAriaLabel: "Change interface language. Current: {language}",
    menuTitle: "Interface language",
    current: "Current",
    changed: "Language changed to {language}",
    justNow: "Just now",
  },
  es: {
    label: "Idioma",
    selectorAriaLabel: "Cambiar idioma de la interfaz. Actual: {language}",
    menuTitle: "Idioma de la interfaz",
    current: "Actual",
    changed: "Idioma cambiado a {language}",
    justNow: "Justo ahora",
  },
  pt: {
    label: "Idioma",
    selectorAriaLabel: "Alterar idioma da interface. Atual: {language}",
    menuTitle: "Idioma da interface",
    current: "Atual",
    changed: "Idioma alterado para {language}",
    justNow: "Agora mesmo",
  },
};

/**
 * "Language changed to Español", written in the *new* language. Used for the
 * confirmation toast — both when the user picks a language and when the
 * account's saved language is applied at sign-in.
 */
export function languageChangedMessage(locale: Locale): string {
  return interpolate(locale, PACKAGE_MESSAGES[locale].changed, {
    language: LOCALE_META[locale].nativeName,
  });
}
