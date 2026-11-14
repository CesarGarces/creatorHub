"use client";

import { createI18n } from "@creator-hub/i18n";
import { translator, type Messages } from "./translate";

const i18n = createI18n<Messages>({
  translator,
  // Same cookie as the web app. With a shared domain (e.g.
  // ".creatorhubplatform.com") the language picked here is already active
  // when the visitor signs up or logs in — and vice versa.
  cookieDomain: process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN,
});

export const { I18nProvider, useI18n } = i18n;
