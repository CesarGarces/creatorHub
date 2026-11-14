/**
 * Client-side locale state (from @creator-hub/i18n) plus a `t()` bound to
 * the web app's dictionaries for code that cannot use hooks: zustand stores,
 * socket handlers, toasts.
 */
import { getClientLocale } from "@creator-hub/i18n";
import {
  translate,
  type TranslationKey,
  type TranslationParams,
} from "./translate";

export {
  getClientLocale,
  initClientLocale,
  persistLocale,
  setClientLocale,
  subscribeToLocale,
  __resetClientLocaleForTests,
} from "@creator-hub/i18n";

/** Translate outside React using the current interface language. */
export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(getClientLocale(), key, params);
}
