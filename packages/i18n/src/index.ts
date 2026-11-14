// Server-safe building blocks
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_DAYS,
  LOCALE_META,
  isLocale,
  matchAcceptLanguage,
  resolveRequestLocale,
} from "./config";
export type { Locale, LocaleMeta } from "./config";

export { createTranslator, interpolate } from "./core";
export type {
  DictionaryShape,
  KeyOf,
  TranslationParams,
  Translator,
} from "./core";

export {
  buildLocaleCookie,
  configureLocaleCookie,
  getClientLocale,
  initClientLocale,
  persistLocale,
  setClientLocale,
  subscribeToLocale,
  __resetClientLocaleForTests,
} from "./runtime";
export type { LocaleCookieOptions } from "./runtime";

export { findDictionaryIssues } from "./validate";
export { PACKAGE_MESSAGES, languageChangedMessage } from "./package-messages";
export type { PackageMessages } from "./package-messages";

// React (client components)
export { createI18n, renderRich, useLocaleContext } from "./react";
export type { CreateI18nOptions, I18nValue, LocaleContextValue } from "./react";

export { LanguageSelector, LanguageOptions } from "./language-selector";
export type {
  LanguageChangedHandler,
  LanguageOptionsProps,
  LanguageSelectorProps,
} from "./language-selector";
