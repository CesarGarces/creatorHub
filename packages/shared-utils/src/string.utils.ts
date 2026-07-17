export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Redacts sensitive header values (Authorization, Cookie, etc.) for safe logging.
 * Returns a new object with sensitive values replaced by "[REDACTED]".
 */
export function redactSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const sensitiveKeys = new Set([
    "authorization",
    "cookie",
    "x-api-key",
    "x-auth-token",
  ]);
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }

  return result;
}
