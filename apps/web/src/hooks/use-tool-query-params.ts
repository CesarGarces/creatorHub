"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat.store";

/**
 * Hook that reads chat input params from URL and auto-sends to chat.
 *
 * Usage in any tool page:
 * ```tsx
 * useToolQueryParams(); // reads ?text=..., ?prompt=..., ?topic=..., ?query=...
 * ```
 *
 * The AI system prompt must use the correct param names per tool:
 * - x-post-tweet: { "text": "..." }
 * - x-search-trends: { "text": "..." }
 * - content-translator: { "prompt": "..." }
 * - thumbnail-generator: { "prompt": "..." }
 *
 * If no recognized param is found, does nothing.
 * Clears params from URL after sending.
 */
export function useToolQueryParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const hasAutoSent = useRef(false);

  useEffect(() => {
    if (hasAutoSent.current) return;

    const paramOrder = ["text", "prompt", "topic", "query", "content"];
    let message = "";

    for (const key of paramOrder) {
      const value = searchParams.get(key);
      if (value) {
        message = value;
        break;
      }
    }

    if (!message) return;

    hasAutoSent.current = true;
    sendMessage(message);

    const url = new URL(window.location.href);
    for (const key of paramOrder) {
      url.searchParams.delete(key);
    }
    router.replace(url.pathname);
  }, [searchParams, router, sendMessage]);
}
