import { cookies, headers } from "next/headers";
import {
  isLocale,
  LOCALE_COOKIE,
  matchAcceptLanguage,
  type Locale,
} from "./config";

/**
 * Locale for the current request:
 * 1. the language the user explicitly chose (cookie), otherwise
 * 2. the best match for the browser's Accept-Language, otherwise
 * 3. the default locale.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const headerStore = await headers();
  return matchAcceptLanguage(headerStore.get("accept-language"));
}
