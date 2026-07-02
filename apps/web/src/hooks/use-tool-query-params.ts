"use client";

import { useEffect, useState } from "react";

const PARAM_ORDER = ["prompt", "text", "topic", "query", "content"];

/**
 * Hook that reads chat input params from URL and returns the message.
 *
 * Usage in any tool page:
 * ```tsx
 * const promptFromUrl = useToolQueryParams();
 *
 * useEffect(() => {
 *   if (promptFromUrl) {
 *     handleSend(promptFromUrl);
 *   }
 * }, [promptFromUrl]);
 * ```
 *
 * All tools should use "prompt" as the primary param name.
 * The hook also supports: text, topic, query, content as fallbacks.
 *
 * Returns the message string if a param was found, null otherwise.
 */
export function useToolQueryParams(): string | null {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);

      for (const key of PARAM_ORDER) {
        const value = params.get(key);
        if (value) {
          setMessage(value);

          const url = new URL(window.location.href);
          for (const k of PARAM_ORDER) {
            url.searchParams.delete(k);
          }
          window.history.replaceState({}, "", url.pathname);
          break;
        }
      }
    } catch {
      // ignore errors
    }
  }, []);

  return message;
}
