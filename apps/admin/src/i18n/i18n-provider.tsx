"use client";

import { createI18n } from "@creator-hub/i18n";
import { syncLocaleToAccount } from "./account-sync";
import { translator, type Messages } from "./translate";

const i18n = createI18n<Messages>({
  translator,
  onLocaleChange: (locale) => void syncLocaleToAccount(locale),
  // Same cookie as the web app and landing page; with a shared domain the
  // preference follows the admin across all Creator Hub sites.
  cookieDomain: process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN,
});

export const { I18nProvider, useI18n, t } = i18n;
