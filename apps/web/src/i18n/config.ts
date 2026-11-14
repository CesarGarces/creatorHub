/**
 * Interface-language configuration — provided by @creator-hub/i18n so the
 * web app and the landing page share locales, cookie and negotiation.
 */
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_DAYS,
  LOCALE_META,
  isLocale,
  matchAcceptLanguage,
} from "@creator-hub/i18n";
export type { Locale, LocaleMeta } from "@creator-hub/i18n";
