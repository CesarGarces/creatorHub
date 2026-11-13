/**
 * Keeps the interface language in sync with the signed-in user's account so
 * the preference follows them to other browsers and devices.
 *
 * The cookie (see runtime.ts) is the source of truth for the current
 * browser; the account copy is a best-effort backup, so failures here never
 * block or revert the language change the user just made.
 */
import api from "@/lib/api";
import { getAccessToken } from "@/lib/cookie";
import { isLocale, type Locale } from "./config";
import { getClientLocale, setClientLocale } from "./runtime";

export async function syncLocaleToAccount(locale: Locale): Promise<void> {
  if (!getAccessToken()) return;
  try {
    await api.patch("/auth/preferences", { preferredLanguage: locale });
  } catch (err) {
    console.warn("[i18n] Could not save language to account:", err);
  }
}

/**
 * Called after login/registration with the language stored on the account.
 * - Account has a language → apply it (it is the user's saved preference).
 * - Account has none yet → save the language currently in use.
 */
export function applyAccountLocale(preferred: unknown): void {
  if (isLocale(preferred)) {
    setClientLocale(preferred);
    return;
  }
  void syncLocaleToAccount(getClientLocale());
}
