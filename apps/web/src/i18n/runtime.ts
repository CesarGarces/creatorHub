/**
 * Client-side locale state shared by React (via I18nProvider) and by plain
 * modules such as zustand stores, which cannot use hooks but still show
 * user-facing messages (toasts, errors).
 *
 * On the server this module is never mutated: the request locale flows
 * through React props/context instead, so concurrent requests cannot leak
 * locales into each other.
 */
import { setCookie } from "@/lib/cookie";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_DAYS,
  LOCALE_META,
  type Locale,
} from "./config";
import {
  translate,
  type TranslationKey,
  type TranslationParams,
} from "./translate";

const isBrowser = typeof window !== "undefined";

let currentLocale: Locale | null = null;
const listeners = new Set<() => void>();

/** Seeds the locale on first client render (value comes from the server). */
export function initClientLocale(locale: Locale): void {
  if (!isBrowser || currentLocale !== null) return;
  currentLocale = locale;
}

export function getClientLocale(): Locale {
  return currentLocale ?? DEFAULT_LOCALE;
}

export function subscribeToLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function persistLocale(locale: Locale): void {
  setCookie(LOCALE_COOKIE, locale, LOCALE_COOKIE_MAX_AGE_DAYS);
}

/**
 * Switches the UI language immediately for the whole app and remembers it
 * for future sessions (cookie). Returns false when nothing changed.
 */
export function setClientLocale(locale: Locale): boolean {
  if (!isBrowser) return false;
  persistLocale(locale);
  if (locale === currentLocale) return false;

  currentLocale = locale;
  document.documentElement.lang = LOCALE_META[locale].intlLocale;
  listeners.forEach((listener) => listener());
  return true;
}

/** Translate outside React (stores, socket handlers, toasts). */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(getClientLocale(), key, params);
}

/** Test helper: forget the current locale. */
export function __resetClientLocaleForTests(): void {
  currentLocale = null;
  listeners.clear();
}
