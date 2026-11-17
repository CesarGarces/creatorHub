import { useLayoutEffect, type ReactNode } from "react";
import { isLocale, setClientLocale, type Locale } from "@creator-hub/i18n";

/** The toolbar's language (globals.locale), as a valid Locale. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : "en";
}

/**
 * Applies the toolbar language to the shared i18n runtime, which every app
 * provider and the shared LanguageSelector read.
 */
export function LocaleSync({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  useLayoutEffect(() => {
    setClientLocale(locale);
  }, [locale]);
  return <>{children}</>;
}
