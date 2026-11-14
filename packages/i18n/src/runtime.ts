/**
 * Client-side locale state shared by React (through the provider) and by
 * plain modules (stores, socket handlers) that cannot use hooks.
 *
 * On the server this module is never mutated: the request locale flows
 * through React props/context instead, so concurrent requests cannot leak
 * locales into each other.
 */
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_DAYS,
  LOCALE_META,
  type Locale,
} from "./config";

const isBrowser = typeof window !== "undefined";

let currentLocale: Locale | null = null;
let cookieDomain: string | undefined;
const listeners = new Set<() => void>();

export interface LocaleCookieOptions {
  /**
   * Share the preference across subdomains (e.g. ".creatorhubplatform.com"
   * so the landing page and the app remember the same choice). Leave empty
   * for a host-only cookie.
   */
  domain?: string;
}

export function configureLocaleCookie(options: LocaleCookieOptions): void {
  cookieDomain = options.domain || undefined;
}

/** Serializes the preference cookie (exported for tests). */
export function buildLocaleCookie(
  locale: Locale,
  { domain, secure }: { domain?: string; secure?: boolean } = {},
): string {
  const expires = new Date(
    Date.now() + LOCALE_COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toUTCString();
  return [
    `${LOCALE_COOKIE}=${locale}`,
    `Expires=${expires}`,
    "Path=/",
    // Lax: sent on normal navigations between the landing page and the app.
    "SameSite=Lax",
    domain ? `Domain=${domain}` : "",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function persistLocale(locale: Locale): void {
  if (!isBrowser) return;
  document.cookie = buildLocaleCookie(locale, {
    domain: cookieDomain,
    secure: window.location.protocol === "https:",
  });
}

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

/**
 * Switches the UI language immediately everywhere and remembers it for
 * future sessions (cookie). Returns false when nothing changed.
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

/** Test helper: forget the current locale and listeners. */
export function __resetClientLocaleForTests(): void {
  currentLocale = null;
  listeners.clear();
}
