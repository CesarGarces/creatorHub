import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  resolveRequestLocale,
  type Locale,
} from "@creator-hub/i18n";

/**
 * Locale for the current request: the saved choice (cookie), otherwise the
 * browser's Accept-Language, otherwise English.
 */
export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveRequestLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );
}
