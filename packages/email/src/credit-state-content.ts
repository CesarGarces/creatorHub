import type {
  CreditStateEmailContent,
  CreditStateEmailVariables,
} from "./interfaces/email.types";

/** Variables admins can use in credit state emails. */
export const CREDIT_EMAIL_VARIABLES: ReadonlyArray<{
  key: keyof CreditStateEmailVariables;
  description: string;
}> = [
  { key: "name", description: "User's name (or email if they have no name)" },
  { key: "credits", description: "Credits remaining" },
  {
    key: "threshold",
    description: "The credit level that triggered the email",
  },
  { key: "purchaseUrl", description: "Link to the credits purchase page" },
];

/**
 * Replaces {{name}}, {{credits}}, {{threshold}} and {{purchaseUrl}}.
 *
 * Admin-written text is NEVER compiled as a Handlebars template (that would
 * allow template injection). Only these known placeholders are substituted;
 * anything else is left as-is and later HTML-escaped by the email template.
 */
export function interpolateCreditEmailText(
  text: string,
  vars: CreditStateEmailVariables,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key)
      ? String(vars[key as keyof CreditStateEmailVariables])
      : match,
  );
}

/** Only http(s) links are allowed in the button (no javascript:, data:, ...). */
export function isSafeEmailUrl(url: string): boolean {
  return /^https?:\/\/[^\s]+$/i.test(url.trim());
}

export interface RenderedCreditStateContent {
  subject: string;
  heading: string;
  paragraphs: string[][];
  ctaLabel: string | null;
  ctaUrl: string | null;
}

export function buildCreditStateContent(
  content: CreditStateEmailContent,
  vars: CreditStateEmailVariables,
): RenderedCreditStateContent {
  const subject = interpolateCreditEmailText(content.subject, vars)
    .replace(/[\r\n]+/g, " ")
    .trim();
  const heading = interpolateCreditEmailText(content.heading, vars).trim();

  const paragraphs = interpolateCreditEmailText(content.body, vars)
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);

  const label = content.ctaLabel?.trim()
    ? interpolateCreditEmailText(content.ctaLabel, vars).trim()
    : null;
  const url = interpolateCreditEmailText(
    content.ctaUrl?.trim() || "{{purchaseUrl}}",
    vars,
  ).trim();
  const showCta = Boolean(label) && isSafeEmailUrl(url);

  return {
    subject,
    heading,
    paragraphs,
    ctaLabel: showCta ? label : null,
    ctaUrl: showCta ? url : null,
  };
}
