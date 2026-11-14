"use client";

import { createI18n, type I18nValue } from "@creator-hub/i18n";
import { syncLocaleToAccount } from "./account-sync";
import { translator, type Messages } from "./translate";

export { renderRich } from "@creator-hub/i18n";

export type I18nContextValue = I18nValue<Messages>;

const i18n = createI18n<Messages>({
  translator,
  // Signed-in users also get the choice saved to their account.
  onLocaleChange: (locale) => void syncLocaleToAccount(locale),
  // Optional, e.g. ".creatorhubplatform.com": shares the choice with the
  // landing page (and any other subdomain).
  cookieDomain: process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN,
});

export const { I18nProvider, useI18n, changeLocale } = i18n;
