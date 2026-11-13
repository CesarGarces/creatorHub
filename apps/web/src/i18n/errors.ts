/**
 * Turns errors (mostly API errors whose messages are written in English by
 * the backend) into text in the user's interface language.
 *
 * Known server messages are mapped to translations. Unknown messages are
 * shown as-is (they usually carry useful detail), and empty ones fall back
 * to the caller-provided translated message.
 */
import { t } from "./runtime";
import type { TranslationKey, TranslationParams } from "./translate";

const EXACT_MESSAGES: Record<string, TranslationKey> = {
  "Invalid credentials": "errors.invalidCredentials",
  "Email already registered": "errors.emailAlreadyRegistered",
  "User with this email already exists": "errors.emailAlreadyRegistered",
  "Current password is incorrect": "errors.currentPasswordIncorrect",
  "No password set for this account": "errors.noPasswordSet",
  "Password must be at least 8 characters": "errors.passwordTooShort",
  "New password must be at least 8 characters": "errors.passwordTooShort",
  "Invalid verification code": "errors.invalidVerificationCode",
  "No verification code pending. Please request a new one.":
    "errors.noVerificationPending",
  "Verification code has expired. Please request a new one.":
    "errors.verificationExpired",
  "Email is already verified": "errors.emailAlreadyVerified",
  "Invalid or expired reset token": "errors.invalidResetToken",
  "User not found": "errors.userNotFound",
  "Session expired": "errors.sessionExpired",
  "Selected provider is not available": "errors.providerUnavailable",
  "Prompt is required": "errors.promptRequired",
  "Topic is required": "errors.topicRequired",
  "Text is required": "errors.textRequired",
  "Content is required": "errors.textRequired",
  "Tweet text is required": "errors.textRequired",
  "Tweet exceeds 280 characters": "errors.tweetTooLong",
  "Tweet content exceeds 280 characters": "errors.tweetTooLong",
  "Minimum amount is $10": "errors.minimumAmount",
  "Payment gateway not configured": "errors.paymentUnavailable",
  "X OAuth credentials not configured": "errors.xNotConfigured",
  "Asset not found": "errors.notFound",
  "Image not found": "errors.notFound",
  "Script not found": "errors.notFound",
  "Draft not found": "errors.notFound",
  "This asset is not public": "errors.assetNotPublic",
};

const PATTERNS: Array<{
  pattern: RegExp;
  key: TranslationKey;
  params?: (match: RegExpMatchArray) => TranslationParams;
}> = [
  { pattern: /^Insufficient credits/i, key: "errors.insufficientCredits" },
  {
    pattern: /^Please wait (\d+) seconds? before requesting a new code/i,
    key: "errors.waitSeconds",
    params: (m) => ({ count: Number(m[1]) }),
  },
  {
    pattern: /ThrottlerException|Too Many Requests/i,
    key: "errors.tooManyRequests",
  },
  {
    pattern: /Failed to fetch|NetworkError|Load failed|Network request failed/i,
    key: "errors.network",
  },
  // Technical messages thrown by our own client code: use the caller's
  // friendlier fallback instead ("Request failed (500)", stream errors...).
  {
    pattern:
      /^(Request failed \(\d+\)|Chat request failed: \d+|Response body is not readable)$/,
    key: "errors.generic",
  },
];

function extractMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

export function localizeError(
  err: unknown,
  fallbackKey: TranslationKey = "errors.generic",
  fallbackParams?: TranslationParams,
): string {
  const status =
    err && typeof err === "object" && "status" in err
      ? (err as { status?: unknown }).status
      : undefined;
  if (status === 429) return t("errors.tooManyRequests");

  const message = extractMessage(err).trim();
  if (!message) return t(fallbackKey, fallbackParams);

  const exact = EXACT_MESSAGES[message];
  if (exact) return t(exact);

  for (const { pattern, key, params } of PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return key === "errors.generic"
        ? t(fallbackKey, fallbackParams)
        : t(key, params?.(match));
    }
  }
  return message;
}
