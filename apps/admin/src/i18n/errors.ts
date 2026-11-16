/**
 * Turns admin API errors (English messages from the backend) into text in
 * the interface language. Unknown messages are shown as sent — they usually
 * carry useful detail for administrators.
 */
import { t } from "./i18n-provider";
import type { TranslationKey } from "./translate";

const EXACT: Record<string, TranslationKey> = {
  "Verify your email and password": "errors.invalidCredentials",
  "User with this email already exists": "errors.emailExists",
  "You cannot deactivate your own account": "errors.cannotDeactivateSelf",
  "Cannot deactivate the last active admin": "errors.lastAdmin",
  "Admin access required": "errors.adminRequired",
  "A model with this id already exists for this provider": "errors.modelExists",
  "Only models added manually can be deleted. Deactivate synced models instead.":
    "errors.onlyCustomDeletable",
};

const SLUG_EXISTS: Array<[RegExp, TranslationKey]> = [
  [/^Credit plan with slug "(.+)" already exists$/, "errors.planSlugExists"],
  [/^Mode with slug "(.+)" already exists$/, "errors.modeSlugExists"],
  [/^Provider with slug "(.+)" already exists$/, "errors.providerSlugExists"],
];

function extractMessage(err: unknown): string {
  const data = (err as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) return String(message[0] ?? "");
  if (typeof message === "string") return message;
  return "";
}

export function localizeError(
  err: unknown,
  fallbackKey: TranslationKey = "errors.generic",
): string {
  const hasResponse = Boolean((err as { response?: unknown } | null)?.response);
  if (err && !hasResponse && (err as { isAxiosError?: boolean }).isAxiosError) {
    return t("errors.network");
  }

  const message = extractMessage(err).trim();
  if (!message) return t(fallbackKey);

  const exact = EXACT[message];
  if (exact) return t(exact);

  for (const [pattern, key] of SLUG_EXISTS) {
    const match = message.match(pattern);
    if (match) return t(key, { slug: match[1] ?? "" });
  }
  if (/ not found(:|$)/i.test(message)) return t("errors.notFound");

  return message;
}
