"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: { label: string; href?: string; icon?: string }[];
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hi! I'm your YouTube Agent. I can help you with:\n\n• Video ideas and scripts\n• Thumbnail generation\n• Title optimization\n• SEO tags and descriptions\n\nWhat would you like to create today?",
  },
];

const suggestions = [
  "Give me a viral video idea about React",
  "Write a script for a 10-minute tutorial",
  "Generate a thumbnail for my next video",
  "Optimize my video title for views",
];

export default function AgentChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    const agentMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: `Based on your request about "${input}", here are my suggestions:\n\n1. **Viral Video Idea**: "Why ${input} is Changing Everything"\n   → [Generate Script] [Generate Thumbnail]\n\n2. **Tutorial Format**: "How to Master ${input} in 2024"\n   → [Generate Script] [Generate Thumbnail]\n\n3. **Listicle**: "Top 10 ${input} Tips Nobody Tells You"\n   → [Generate Script] [Generate Thumbnail]\n\nWould you like me to generate content for any of these?`,
      actions: [
        { label: "Generate Script", icon: "📝" },
        {
          label: "Generate Thumbnail",
          icon: "🎨",
          href: "/tools/thumbnail-generator",
        },
      ],
    };

    setMessages((prev) => [...prev, userMessage, agentMessage]);
    setInput("");
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Agents", href: "/agents" },
          { label: "YouTube Agent" },
        ]}
        actions={
          <button
            onClick={() => setMessages(initialMessages)}
            className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
          >
            New Chat
          </button>
        }
      />
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 max-w-3xl mx-auto animate-slide-up ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm ${
                  msg.role === "assistant"
                    ? "bg-primary text-white"
                    : "bg-surface-elevated text-text-muted"
                }`}
              >
                {msg.role === "assistant" ? "🤖" : "👤"}
              </div>
              <div
                className={`rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                  msg.role === "assistant"
                    ? "bg-surface border border-border text-text"
                    : "bg-primary text-white ml-auto"
                }`}
              >
                <div
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\n/g, "<br/>"),
                  }}
                />
                {msg.actions && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => action.href && router.push(action.href)}
                        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text hover:border-primary/30 transition-all"
                      >
                        <span>{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-6 pb-4">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted hover:text-text hover:border-primary/30 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-surface p-4">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSend()
              }
              placeholder="Type a message..."
              className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="22" x2="11" y1="2" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
