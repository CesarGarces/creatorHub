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
import type { KeyOf, TranslationParams, Translator } from "./core";
import { PACKAGE_MESSAGES } from "./package-messages";
import {
  configureLocaleCookie,
  getClientLocale,
  initClientLocale,
  setClientLocale,
  subscribeToLocale,
} from "./runtime";

type RichRenderer = (chunks: string) => ReactNode;

export interface I18nValue<M> {
  locale: Locale;
  /** BCP 47 tag for Intl APIs, e.g. "es-ES". */
  intlLocale: string;
  /** Changes the UI language everywhere and remembers it. */
  setLocale: (locale: Locale) => boolean;
  t: (key: KeyOf<M>, params?: TranslationParams) => string;
  /**
   * For data-driven keys that may not exist (e.g. an item coming from the
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
    key: KeyOf<M>,
    components: Record<string, RichRenderer>,
    params?: TranslationParams,
  ) => ReactNode;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (
    value: string | number | Date,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  /** "Just now", "5m ago", "hace 3 h"... */
  formatRelativeTime: (value: string | number | Date) => string;
  /** Name of a language in the UI language: "fr" → "French" / "Francés". */
  formatLanguageName: (code: string) => string;
}

/** App-independent part of the context, used by the shared selector. */
export interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Current locale + setter, available in any app using createI18n. */
export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  return ctx ?? { locale: getClientLocale(), setLocale: setClientLocale };
}

const RICH_TAG = /<(\w+)>([\s\S]*?)<\/\1>/g;

/** Renders `<tag>text</tag>` segments with the given components. */
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

export interface CreateI18nOptions<M> {
  translator: Translator<M>;
  /** Called after the user switches language (e.g. save it to the account). */
  onLocaleChange?: (locale: Locale) => void;
  /** Share the preference cookie across subdomains (see configureLocaleCookie). */
  cookieDomain?: string;
}

/**
 * Binds an app's dictionaries to React. Call once per app, at module level,
 * and re-export what the app needs.
 */
export function createI18n<M>({
  translator,
  onLocaleChange,
  cookieDomain,
}: CreateI18nOptions<M>) {
  configureLocaleCookie({ domain: cookieDomain });

  const I18nContext = createContext<I18nValue<M> | null>(null);

  /** Switches locale locally, then notifies the app. */
  function changeLocale(locale: Locale): boolean {
    const changed = setClientLocale(locale);
    if (changed) onLocaleChange?.(locale);
    return changed;
  }

  /** Translate outside React (stores, socket handlers, toasts). */
  function t(key: KeyOf<M>, params?: TranslationParams): string {
    return translator.translate(getClientLocale(), key, params);
  }

  function buildValue(
    locale: Locale,
    setLocale: (locale: Locale) => boolean,
  ): I18nValue<M> {
    const intlLocale = LOCALE_META[locale].intlLocale;
    const translate = (key: KeyOf<M>, params?: TranslationParams) =>
      translator.translate(locale, key, params);

    return {
      locale,
      intlLocale,
      setLocale,
      t: translate,
      tOptional: (key, fallback, params) =>
        translator.translateOptional(locale, key, fallback, params),
      rich: (key, components, params) =>
        renderRich(translate(key, params), components),
      formatNumber: (value, options) =>
        new Intl.NumberFormat(intlLocale, options).format(value),
      formatDate: (value, options) =>
        new Intl.DateTimeFormat(intlLocale, options).format(new Date(value)),
      formatRelativeTime: (value) => {
        const seconds = Math.round(
          (new Date(value).getTime() - Date.now()) / 1000,
        );
        const abs = Math.abs(seconds);
        if (abs < 60) return PACKAGE_MESSAGES[locale].justNow;
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
          const name = new Intl.DisplayNames(intlLocale, {
            type: "language",
          }).of(code);
          if (!name || name === code) return code.toUpperCase();
          return name.charAt(0).toLocaleUpperCase(intlLocale) + name.slice(1);
        } catch {
          return code.toUpperCase();
        }
      },
    };
  }

  function I18nProvider({
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
      () => buildValue(locale, setLocale),
      [locale, setLocale],
    );
    const base = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

    return (
      <LocaleContext.Provider value={base}>
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
      </LocaleContext.Provider>
    );
  }

  /**
   * Access translations. Works without a provider too (falls back to the
   * runtime locale), which keeps isolated component tests simple.
   */
  function useI18n(): I18nValue<M> {
    const ctx = useContext(I18nContext);
    if (ctx) return ctx;
    return buildValue(getClientLocale(), changeLocale);
  }

  return { I18nProvider, useI18n, changeLocale, t };
}
