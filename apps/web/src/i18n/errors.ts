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
  "Session not found": "errors.notFound",
  "Project not found": "errors.notFound",
  "The session must end after it starts":
    "contentPlanner.event.errors.endBeforeStart",
  "A session can't be longer than 24 hours":
    "contentPlanner.event.errors.tooLong",
  "Type not found": "errors.notFound",
  "Type name is required": "contentPlanner.customTypes.errors.nameRequired",
  "A type with this name already exists":
    "contentPlanner.customTypes.errors.duplicate",
  "Platform not found": "errors.notFound",
  "Platform name is required":
    "contentPlanner.customPlatforms.errors.nameRequired",
  "A platform with this name already exists":
    "contentPlanner.customPlatforms.errors.duplicate",
  "Every added step needs a name":
    "contentPlanner.plan.steps.errors.nameRequired",
  "AI plan not found": "errors.notFound",
  "Describe your idea, record it or attach a file (at least 10 characters)":
    "contentPlanner.ai.needInput",
  "The model didn't return a valid plan. Try again or choose another model.":
    "contentPlanner.ai.invalidPlan",
  "Planning failed. Please try again.": "contentPlanner.ai.failed",
  "Too many files": "contentPlanner.ai.fileErrors.count",
  "This model can't analyze video frames. Choose a vision model.":
    "videoClipper.errors.notVision",
  "The model didn't return a valid analysis. Try again or choose another model.":
    "videoClipper.errors.invalidAnalysis",
  "The AI model couldn't analyze this video. Try again or choose another model.":
    "videoClipper.errors.modelFailed",
  "Analysis not found": "errors.notFound",
};

const PATTERNS: Array<{
  pattern: RegExp;
  key: TranslationKey;
  params?: (match: RegExpMatchArray) => TranslationParams;
}> = [
  { pattern: /^Insufficient credits/i, key: "errors.insufficientCredits" },
  // Nested DTO errors arrive prefixed with the field path ("video.…").
  {
    pattern: /Videos larger than 250 MB are not supported yet/,
    key: "videoClipper.errors.tooLarge",
  },
  {
    pattern: /^You can have up to (\d+) custom types/,
    key: "contentPlanner.customTypes.errors.limit",
    params: (m) => ({ max: Number(m[1]) }),
  },
  {
    pattern: /^You can have up to (\d+) custom platforms/,
    key: "contentPlanner.customPlatforms.errors.limit",
    params: (m) => ({ max: Number(m[1]) }),
  },
  {
    pattern: /^Unsupported file type: "(.+)"/,
    key: "contentPlanner.ai.fileErrors.type",
    params: (m) => ({ name: m[1]! }),
  },
  {
    pattern: /^"(.+)" is larger than 5 MB$/,
    key: "contentPlanner.ai.fileErrors.size",
    params: (m) => ({ name: m[1]! }),
  },
  {
    pattern: /^Couldn't read "(.+)"$/,
    key: "contentPlanner.ai.fileErrors.unreadable",
    params: (m) => ({ name: m[1]! }),
  },
  {
    pattern: /^"(.+)" has no readable text$/,
    key: "contentPlanner.ai.fileErrors.empty",
    params: (m) => ({ name: m[1]! }),
  },
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
