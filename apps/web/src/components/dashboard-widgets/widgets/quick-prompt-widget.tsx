"use client";

import { useState } from "react";
import { useChatStore } from "@/store/chat.store";
import { useI18n } from "@/i18n/i18n-provider";
import { QUICK_PROMPT_EXAMPLES as EXAMPLES } from "./quick-prompt-examples";

/**
 * Quick prompt widget: sends the text to the assistant chat. Keeps its
 * state local, so typing re-renders only the prompt, not the dashboard.
 */
export function QuickPromptWidget() {
  const { t } = useI18n();
  const { sendMessage, isStreaming, openWidget } = useChatStore();
  const [quickPrompt, setQuickPrompt] = useState("");

  const send = () => {
    const text = quickPrompt.trim();
    if (!text || isStreaming) return;
    openWidget();
    sendMessage(text);
    setQuickPrompt("");
  };

  return (
    // Room for the examples row, tucked under the box from sm.
    <div className="relative sm:pb-6">
      <div className="rounded-xl border border-border bg-surface p-1 shadow-lg shadow-primary/5">
        <div className="flex items-center gap-2 sm:gap-3 rounded-lg bg-surface-elevated px-3 py-2 sm:px-4 sm:py-3">
          <span
            aria-hidden="true"
            className="hidden text-primary min-[400px]:inline"
          >
            ✦
          </span>
          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder={t("dashboard.quickPrompt.placeholder")}
            aria-label={t("dashboard.quickPrompt.ariaLabel")}
            className="min-w-0 flex-1 bg-transparent text-sm text-text placeholder:text-text-dim outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={isStreaming || !quickPrompt.trim()}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 pointer-coarse:min-h-11 sm:px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming
              ? t("dashboard.quickPrompt.making")
              : t("dashboard.quickPrompt.generate")}
          </button>
        </div>
      </div>
      {/* In the flow (wrapping) on phones; tucked under the box from sm. */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs text-text-dim sm:absolute sm:bottom-0 sm:left-4 sm:mt-0 sm:flex-nowrap sm:px-0">
        <span>{t("dashboard.quickPrompt.try")}</span>
        {EXAMPLES.map((key, i) => (
          <span key={key} className="contents">
            {i > 0 && <span aria-hidden="true">·</span>}
            <button
              type="button"
              onClick={() => setQuickPrompt(t(key))}
              className="text-primary/70 hover:text-primary transition-colors"
            >
              {t(key)}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
