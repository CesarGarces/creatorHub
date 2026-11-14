/**
 * Saves the admin's interface language to their account, like the web app
 * does for users, so it is restored on any device. Admin tokens are
 * regular user JWTs, so the shared `PATCH /auth/preferences` endpoint works.
 *
 * Best effort: the cookie already remembers the choice on this browser, so
 * failures never block or revert the change.
 */
import {
  getClientLocale,
  isLocale,
  languageChangedMessage,
  setClientLocale,
  type Locale,
} from "@creator-hub/i18n";
import { toast } from "sonner";
import api from "@/lib/api";

export async function syncLocaleToAccount(locale: Locale): Promise<void> {
  if (typeof window === "undefined" || !localStorage.getItem("admin_token")) {
    return;
  }
  try {
    await api.patch("/auth/preferences", { preferredLanguage: locale });
  } catch (err) {
    console.warn("[i18n] Could not save language to account:", err);
  }
}

/**
 * After login: apply the language saved on the account, or save the one in
 * use when the account has none yet.
 */
export function applyAccountLocale(preferred: unknown): void {
  if (isLocale(preferred)) {
    if (setClientLocale(preferred)) {
      // Explain the switch (and replace any earlier language toast).
      toast.success(languageChangedMessage(preferred), {
        id: "language-changed",
        position: "top-center",
      });
    }
    return;
  }
  void syncLocaleToAccount(getClientLocale());
}
