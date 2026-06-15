const FRIENDLY_PATTERNS: Array<{ patterns: string[]; message: string }> = [
  {
    patterns: ["429", "resource_exhausted", "rate limit", "quota", "credits", "billing", "depleted"],
    message:
      "AI is taking a break. The provider is taking longer than usual to process the details. Don't worry, your credits are safe. Shall we try again?",
  },
  {
    patterns: ["timeout", "timed out"],
    message:
      "The request took too long. The provider might be busy. Your credits are safe. Shall we try again?",
  },
  {
    patterns: ["insufficient credits"],
    message: "You don't have enough credits. Buy more to keep generating.",
  },
  {
    patterns: ["prohibited", "sensitive content", "content policy", "20021"],
    message:
      "The prompt was blocked by the AI provider's content filter. Please try a different prompt — avoid violence, adult content, or sensitive topics.",
  },
];

const DEFAULT_FRIENDLY_ERROR =
  "Something went wrong. Don't worry, your credits are safe. Shall we try again?";

export function getFriendlyError(errorMessage: string): string {
  const msg = errorMessage.toLowerCase();
  for (const { patterns, message } of FRIENDLY_PATTERNS) {
    if (patterns.some((p) => msg.includes(p))) {
      return message;
    }
  }
  return DEFAULT_FRIENDLY_ERROR;
}
