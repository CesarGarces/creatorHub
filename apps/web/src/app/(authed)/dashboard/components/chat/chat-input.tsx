"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chat.store";

export function ChatInput() {
  const [input, setInput] = useState("");
  const { sendMessage, isStreaming } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          aria-label="Chat message input"
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary/50 transition-colors"
          disabled={isStreaming}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStreaming ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          )}
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-dim">
        <span>Enter to send</span>
        <span>·</span>
        <span>Shift+Enter for new line</span>
      </div>
    </div>
  );
}
