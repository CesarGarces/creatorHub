import type {
  AIChatContentPart,
  AIChatMessageContent,
  AIRequest,
} from "@creator-hub/shared-types";

/**
 * Content of the user message for a request: the prompt as plain text, or —
 * when images are attached (vision models) — OpenAI-compatible parts: the
 * prompt, then every image preceded by its caption.
 */
export function buildUserMessageContent(
  request: Pick<AIRequest, "prompt" | "images">,
): AIChatMessageContent {
  if (!request.images?.length) return request.prompt;
  const parts: AIChatContentPart[] = [{ type: "text", text: request.prompt }];
  for (const image of request.images) {
    if (image.caption) parts.push({ type: "text", text: image.caption });
    parts.push({
      type: "image_url",
      image_url: { url: image.url, detail: image.detail ?? "auto" },
    });
  }
  return parts;
}
