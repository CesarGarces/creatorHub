import DOMPurify from "dompurify";

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Use this whenever you need to render dynamic HTML content.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "strong",
      "em",
      "br",
      "a",
      "p",
      "ul",
      "ol",
      "li",
      "code",
      "pre",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
  });
}

/**
 * Converts markdown-like syntax to safe HTML.
 * Handles bold (**text**), line breaks (\n), and links.
 */
export function markdownToSafeHtml(content: string): string {
  const html = content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");

  return sanitizeHtml(html);
}
