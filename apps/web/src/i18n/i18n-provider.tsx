"use client";

import {
  createContext,
  createElement,
  Fragment,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { LOCALE_META, type Locale } from "./config";
import {
  getClientLocale,
  initClientLocale,
  setClientLocale,
  subscribeToLocale,
} from "./runtime";
import { syncLocaleToAccount } from "./account-sync";
import {
  hasTranslation,
  translate,
  type TranslationKey,
  type TranslationParams,
} from "./translate";

type RichRenderer = (chunks: string) => ReactNode;

export interface I18nContextValue {
  locale: Locale;
  /** BCP 47 tag for Intl APIs, e.g. "es-ES". */
  intlLocale: string;
  /** Changes the UI language everywhere and remembers it. */
  setLocale: (locale: Locale) => boolean;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  /**
   * For data-driven keys that may not exist (e.g. a tool coming from the
   * API). Returns `fallback` when the key is unknown.
   */
  tOptional: (
    key: string,
    fallback: string,
    params?: TranslationParams,
  ) => string;
  /**
   * Translates a message containing tags, e.g.
   * `"I agree to the <terms>Terms</terms>"`, rendering each tag with the
   * given component so word order stays correct in every language.
   */
  rich: (
    key: TranslationKey,
    components: Record<string, RichRenderer>,
    params?: TranslationParams,
  ) => ReactNode;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  /** "just now", "5m ago", "hace 3 h"... */
  formatRelativeTime: (value: string | number | Date) => string;
  /** Name of a language in the UI language: "fr" → "French" / "Francés". */
  formatLanguageName: (code: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const RICH_TAG = /<(\w+)>([\s\S]*?)<\/\1>/g;

export function renderRich(
  text: string,
  components: Record<string, RichRenderer>,
): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(RICH_TAG)) {
    const [whole, tag = "", inner = ""] = match;
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
    const render = components[tag];
    parts.push(render ? render(inner) : inner);
    lastIndex = start + whole.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  // Spread as children so React does not require keys.
  return createElement(Fragment, null, ...parts);
}

export function buildI18nValue(
  locale: Locale,
  setLocale: (locale: Locale) => boolean,
): I18nContextValue {
  const intlLocale = LOCALE_META[locale].intlLocale;
  const t = (key: TranslationKey, params?: TranslationParams) =>
    translate(locale, key, params);

  return {
    locale,
    intlLocale,
    setLocale,
    t,
    tOptional: (key, fallback, params) =>
      hasTranslation(locale, key)
        ? translate(locale, key as TranslationKey, params)
        : fallback,
    rich: (key, components, params) =>
      renderRich(translate(locale, key, params), components),
    formatNumber: (value, options) =>
      new Intl.NumberFormat(intlLocale, options).format(value),
    formatDate: (value, options) =>
      new Intl.DateTimeFormat(intlLocale, options).format(new Date(value)),
    formatRelativeTime: (value) => {
      const seconds = Math.round(
        (new Date(value).getTime() - Date.now()) / 1000,
      );
      const abs = Math.abs(seconds);
      if (abs < 60) return t("common.time.justNow");
      const rtf = new Intl.RelativeTimeFormat(intlLocale, {
        numeric: "auto",
        style: "narrow",
      });
      if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
      if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
      return rtf.format(Math.round(seconds / 86_400), "day");
    },
    formatLanguageName: (code) => {
      try {
        const name = new Intl.DisplayNames(intlLocale, { type: "language" }).of(
          code,
        );
        if (!name || name === code) return code.toUpperCase();
        return name.charAt(0).toLocaleUpperCase(intlLocale) + name.slice(1);
      } catch {
        return code.toUpperCase();
      }
    },
  };
}

/** Switches locale locally and, when signed in, saves it to the account. */
export function changeLocale(locale: Locale): boolean {
  const changed = setClientLocale(locale);
  if (changed) void syncLocaleToAccount(locale);
  return changed;
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  /** Locale resolved on the server (cookie → Accept-Language → default). */
  initialLocale: Locale;
  children: ReactNode;
}) {
  initClientLocale(initialLocale);

  const locale = useSyncExternalStore(
    subscribeToLocale,
    getClientLocale,
    () => initialLocale,
  );

  const setLocale = useCallback((next: Locale) => changeLocale(next), []);

  const value = useMemo(
    () => buildI18nValue(locale, setLocale),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access translations. Works without a provider too (falls back to the
 * runtime locale), which keeps isolated component tests simple.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return buildI18nValue(getClientLocale(), changeLocale);
}
