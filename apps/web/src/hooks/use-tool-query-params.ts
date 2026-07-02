"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat.store";

const PARAM_ORDER = ["prompt", "text", "topic", "query", "content"];

/**
 * Hook that reads chat input params from URL and auto-sends to chat.
 *
 * Usage in any tool page:
 * ```tsx
 * useToolQueryParams(); // reads ?prompt=..., auto-sends to chat
 * ```
 *
 * All tools should use "prompt" as the primary param name.
 * The hook also supports: text, topic, query, content as fallbacks.
 *
 * If no recognized param is found, does nothing.
 * Clears params from URL after sending.
 */
export function useToolQueryParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const hasAutoSent = useRef(false);
  const lastParams = useRef<string>("");

  useEffect(() => {
    const paramString = searchParams.toString();

    if (!paramString || paramString === lastParams.current) return;
    if (hasAutoSent.current && lastParams.current) return;

    let message = "";
    for (const key of PARAM_ORDER) {
      const value = searchParams.get(key);
      if (value) {
        message = value;
        break;
      }
    }

    if (!message) return;

    lastParams.current = paramString;
    hasAutoSent.current = true;

    sendMessage(message);

    const url = new URL(window.location.href);
    for (const key of PARAM_ORDER) {
      url.searchParams.delete(key);
    }
    router.replace(url.pathname);
  }, [searchParams, router, sendMessage]);
}
