"use client";

import { useState, useRef, useEffect } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";
import { cn } from "@creator-hub/ui";
import api from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  draft?: {
    id: string;
    content: string;
    status: string;
  };
  isStreaming?: boolean;
}

const suggestions = [
  "Write a tweet about the latest AI trends",
  "Draft a tweet celebrating our product launch",
  "Create a tweet thread about Web3 opportunities",
  "Write a motivational tweet for developers",
];

export default function XPostTweetPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
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
        id: string;
        content: string;
        status: string;
      }>("/social/tweets/draft", {
        topic: text,
        instructions: text,
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Here's a draft tweet for you:`,
        draft: {
          id: response.id,
          content: response.content,
          status: response.status,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `Error: ${error.message || "Failed to generate tweet. Please try again."}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handlePublish = async (draftId: string) => {
    setPublishing(draftId);
    try {
      await api.post(`/social/tweets/drafts/${draftId}/publish`);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.draft?.id === draftId
            ? {
                ...msg,
                draft: { ...msg.draft, status: "PUBLISHED" },
                content: "Tweet published successfully!",
              }
            : msg,
        ),
      );
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Failed to publish: ${error.message || "Please check your X account connection in Settings."}`,
        },
      ]);
    } finally {
      setPublishing(null);
    }
  };

  const handleEdit = async (draftId: string, newContent: string) => {
    try {
      await api.patch(`/social/tweets/drafts/${draftId}`, {
        content: newContent,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.draft?.id === draftId
            ? { ...msg, draft: { ...msg.draft, content: newContent } }
            : msg,
        ),
      );
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `Failed to edit: ${error.message}`,
        },
      ]);
    }
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Post to X" },
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
              New Tweet
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
                <span className="text-3xl">🐦</span>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">
                Post to X (Twitter)
              </h2>
              <p className="text-text-muted mb-8">
                Generate tweets in your unique style and publish them directly
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

                {msg.draft && (
                  <TweetDraftCard
                    draft={msg.draft}
                    isPublishing={publishing === msg.draft.id}
                    onPublish={() => handlePublish(msg.draft!.id)}
                    onEdit={(content) => handleEdit(msg.draft!.id, content)}
                  />
                )}
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
                    Generating tweet...
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
              placeholder="What do you want to tweet about?"
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

function TweetDraftCard({
  draft,
  isPublishing,
  onPublish,
  onEdit,
}: {
  draft: { id: string; content: string; status: string };
  isPublishing: boolean;
  onPublish: () => void;
  onEdit: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(draft.content);

  const charCount = editContent.length;
  const isOverLimit = charCount > 280;

  const handleSave = () => {
    onEdit(editContent);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-surface-elevated p-4">
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface p-3 text-sm text-text resize-none focus:border-primary outline-none"
          rows={4}
        />
        <div className="flex items-center justify-between mt-3">
          <span
            className={cn(
              "text-xs",
              isOverLimit ? "text-red-500" : "text-text-muted",
            )}
          >
            {charCount}/280
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditing(false);
                setEditContent(draft.content);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isOverLimit}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-elevated p-4">
      <p className="text-sm text-text whitespace-pre-wrap">{draft.content}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-text-muted">{charCount}/280 chars</span>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onPublish}
            disabled={isPublishing || draft.status === "PUBLISHED"}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs text-white transition-colors",
              draft.status === "PUBLISHED"
                ? "bg-green-600 cursor-default"
                : "bg-primary hover:bg-primary-hover disabled:opacity-50",
            )}
          >
            {draft.status === "PUBLISHED"
              ? "Published"
              : isPublishing
                ? "Publishing..."
                : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
