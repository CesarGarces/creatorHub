"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { useChatStore } from "@/store/chat.store";
import { useCreditsStore } from "@/store/credits.store";
import { cn } from "@creator-hub/ui";
import api from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const suggestions = [
  "Analyze what's trending on X about AI today",
  "Research trending topics about crypto on Twitter",
  "What are people saying about Web3 on X?",
  "Find trending hashtags about startups",
];

export default function XSearchTrendsPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { balance, fetchBalance } = useCreditsStore();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await api.post<{
        tweets: any[];
        trendingHashtags: string[];
      }>("/tools/x-search-trends/search", {
        topic: text,
        maxTweets: 10,
        timeframe: "24h",
      });

      const results = response.tweets || [];
      const hashtags = response.trendingHashtags || [];

      let assistantContent = "";
      if (results.length > 0) {
        assistantContent = `Found ${results.length} trending posts about "${text}":\n\n`;
        results.slice(0, 5).forEach((result: any, i: number) => {
          const author =
            result.author?.username || result.author?.name || "Unknown";
          const followers = result.author?.followers || 0;
          const metrics = result.metrics || {};
          assistantContent += `${i + 1}. **@${author}** (${followers} followers)\n`;
          assistantContent += `   "${result.text}"\n`;
          assistantContent += `   💬 ${metrics.replies || 0} | 🔁 ${metrics.retweets || 0} | ❤️ ${metrics.likes || 0}\n\n`;
        });

        if (hashtags.length > 0) {
          assistantContent += `\n**Trending Hashtags:** ${hashtags.join(", ")}\n`;
        }

        assistantContent += `\nWould you like me to:\n- Analyze sentiment of these posts?\n- Generate a tweet based on these trends?\n- Research a different topic?`;
      } else {
        assistantContent = `I couldn't find trending posts about "${text}". Try a different search term or check if your Apify API token is configured.`;
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: assistantContent,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error.message || "Failed to search trends. Please try again."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "X Trend Research" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">
              Balance: {balance} credits
            </span>
            <button
              onClick={() => setMessages([])}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              New Search
            </button>
          </div>
        }
      />
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="max-w-3xl mx-auto text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                <span className="text-3xl">🔍</span>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">
                X Trend Research
              </h2>
              <p className="text-text-muted mb-8">
                Search and analyze trending topics on X (Twitter) using AI
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-4 max-w-3xl mx-auto animate-slide-up",
                msg.role === "user" && "flex-row-reverse",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm",
                  msg.role === "assistant"
                    ? "bg-primary text-white"
                    : "bg-surface-elevated text-text-muted",
                )}
              >
                {msg.role === "assistant" ? "🤖" : "👤"}
              </div>
              <div
                className={cn(
                  "rounded-2xl px-5 py-3.5 text-sm leading-relaxed max-w-[80%]",
                  msg.role === "assistant"
                    ? "bg-surface border border-border text-text"
                    : "bg-primary text-white ml-auto",
                )}
              >
                <div
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                      .replace(/\n/g, "<br/>"),
                  }}
                />
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="flex gap-4 max-w-3xl mx-auto">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm">
                🤖
              </div>
              <div className="rounded-2xl px-5 py-3.5 bg-surface border border-border">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-primary rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  <span className="text-sm text-text-muted">
                    Searching trends...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 0 && (
          <div className="px-6 pb-4">
            <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={isStreaming}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted hover:text-text hover:border-primary/30 transition-all disabled:opacity-50"
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
              placeholder="Search for trends on X..."
              disabled={isStreaming}
              className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary transition-colors disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
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
