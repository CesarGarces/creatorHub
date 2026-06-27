"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/chat.store";

export function ChatMessages() {
  const { messages, isStreaming } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.length === 0 && (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mb-3 text-4xl">💬</div>
            <h3 className="text-sm font-semibold text-text">Ask anything</h3>
            <p className="mt-1 text-xs text-text-dim">
              I can help with thumbnails, videos, translations, and more.
            </p>
          </div>
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] rounded-xl px-4 py-3 ${
              message.role === "user"
                ? "bg-primary text-white"
                : "bg-surface-elevated text-text"
            }`}
          >
            {message.role === "assistant" && (
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-xs font-medium text-primary">✦</span>
                <span className="text-[10px] font-medium uppercase tracking-wider text-text-dim">
                  Creator Hub AI
                </span>
              </div>
            )}
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {message.content}
              {isStreaming &&
                message.role === "assistant" &&
                message.id.startsWith("assistant-") && (
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-text" />
                )}
            </div>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.toolCalls.map((tc, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                  >
                    <span>🔧</span>
                    {tc.toolName}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>
  );
}
