"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chat.store";
import { useCreditsStore } from "@/store/credits.store";
import { cn, Badge } from "@creator-hub/ui";
import api from "@/lib/api";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { TweetActionCard } from "@/components/chat/tweet-action-card";
import { ProviderSelect } from "@/components/provider-select";
import { ErrorBoundary } from "@/components/error-boundary";
import { VoiceButton, useVoiceButton } from "@/components/voice-button";

interface ParsedMessage {
  textBefore: string;
  textAfter: string;
  action:
    | { type: "route_to_tool"; toolId: string; params?: Record<string, string> }
    | { type: "preview_tweet"; draftId: string; content: string; topic: string }
    | null;
}

function parseToolAction(content: string): ParsedMessage {
  const jsonBlockRegex =
    /```json\s*(\{[\s\S]*?"action"\s*:\s*"(route_to_tool|preview_tweet)"[\s\S]*?\})\s*```/;
  const match = content.match(jsonBlockRegex);

  if (!match) {
    const rawRegex =
      /(\{\s*"action"\s*:\s*"(route_to_tool|preview_tweet)"[\s\S]*?\})\s*$/;
    const rawMatch = content.match(rawRegex);
    if (rawMatch) {
      try {
        const jsonStr = rawMatch[1]!;
        const parsed = JSON.parse(jsonStr);
        const idx = content.indexOf(jsonStr);

        if (parsed.action === "preview_tweet") {
          return {
            textBefore: content.slice(0, idx).trim(),
            textAfter: "",
            action: {
              type: "preview_tweet",
              draftId: parsed.draftId,
              content: parsed.content,
              topic: parsed.topic,
            },
          };
        }

        return {
          textBefore: content.slice(0, idx).trim(),
          textAfter: "",
          action: {
            type: "route_to_tool",
            toolId: parsed.toolId,
            params: parsed.params,
          },
        };
      } catch {}
    }
    return { textBefore: content, textAfter: "", action: null };
  }

  try {
    const jsonStr = match[1]!;
    const parsed = JSON.parse(jsonStr);
    const idx = match.index!;
    const before = content.slice(0, idx).trim();
    const after = content.slice(idx + match[0].length).trim();

    if (parsed.action === "preview_tweet") {
      return {
        textBefore: before,
        textAfter: after,
        action: {
          type: "preview_tweet",
          draftId: parsed.draftId,
          content: parsed.content,
          topic: parsed.topic,
        },
      };
    }

    return {
      textBefore: before,
      textAfter: after,
      action: {
        type: "route_to_tool",
        toolId: parsed.toolId,
        params: parsed.params,
      },
    };
  } catch {
    return { textBefore: content, textAfter: "", action: null };
  }
}

export function ChatWidget() {
  const router = useRouter();
  const [showSettings, setShowSettings] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const tooltipTimeout = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    sessions,
    activeSessionId,
    messages,
    isStreaming,
    isWidgetOpen,
    settings,
    fetchSessions,
    fetchSettings,
    fetchTools,
    createSession,
    selectSession,
    deleteSession,
    sendMessage,
    updateSettings,
    openWidget,
    closeWidget,
    clearActiveSession,
  } = useChatStore();

  const { balance, plan, isLoading, isHydrated, fetchBalance } =
    useCreditsStore();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const setIsOpen = (open: boolean) => {
    if (open) openWidget();
    else closeWidget();
  };

  useEffect(() => {
    fetchSessions();
    fetchSettings();
    fetchTools();
    fetchBalance();
  }, [fetchSessions, fetchSettings, fetchTools, fetchBalance]);

  useEffect(() => {
    if (isHydrated && !isLoading && balance === 0 && plan === "FREE") {
      setShowUpgradeModal(true);
    }
  }, [isHydrated, isLoading, balance, plan]);

  // Show tooltip after 3s if chat hasn't been opened, auto-dismiss after 20s
  useEffect(() => {
    if (tooltipDismissed) return;
    tooltipTimeout.current = setTimeout(() => {
      if (!isWidgetOpen) setShowTooltip(true);
    }, 3000);
    return () => {
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    };
  }, [isWidgetOpen, tooltipDismissed]);

  // Auto-dismiss tooltip after 20s
  useEffect(() => {
    if (!showTooltip) return;
    const dismissTimer = setTimeout(() => {
      setShowTooltip(false);
      setTooltipDismissed(true);
    }, 20000);
    return () => clearTimeout(dismissTimer);
  }, [showTooltip]);

  // Dismiss tooltip on any open
  useEffect(() => {
    if (isWidgetOpen) {
      setShowTooltip(false);
      setTooltipDismissed(true);
    }
  }, [isWidgetOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isWidgetOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isWidgetOpen]);

  const handleToggle = () => {
    setIsOpen(!isWidgetOpen);
    setShowTooltip(false);
    setTooltipDismissed(true);
  };

  const handleNewChat = () => {
    clearActiveSession();
  };

  return (
    <>
      {/* Backdrop */}
      {isWidgetOpen && (
        <div
          className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[2px] transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Chat Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Chat"
        className={cn(
          "fixed right-0 top-0 z-[95] h-full w-full max-w-[420px]",
          "border-l border-border/50 bg-surface/95 backdrop-blur-xl shadow-2xl shadow-black/10",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isWidgetOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <SparkleIcon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-text">
              Creator Hub AI
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted tabular-nums mr-1">
              {balance} cr
            </span>
            <button
              type="button"
              onClick={handleNewChat}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim hover:text-text hover:bg-surface-elevated transition-colors"
              title="New chat"
              aria-label="New chat"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                showSettings
                  ? "bg-primary/10 text-primary"
                  : "text-text-dim hover:text-text hover:bg-surface-elevated",
              )}
              title="Settings"
              aria-label="Chat settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-dim hover:text-text hover:bg-surface-elevated transition-colors"
              title="Close"
              aria-label="Close chat"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <SettingsPanel
            settings={settings}
            userPlan={plan}
            onUpdate={(partial) => updateSettings(partial)}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Session Selector */}
        {sessions.length > 0 && !showSettings && (
          <div className="border-b border-border px-4 py-2">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
              {sessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className={cn(
                    "group flex flex-shrink-0 items-center rounded-full transition-colors",
                    session.id === activeSessionId
                      ? "bg-primary/15"
                      : "bg-surface-elevated",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectSession(session.id)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium",
                      session.id === activeSessionId
                        ? "text-primary"
                        : "text-text-dim hover:text-text",
                    )}
                  >
                    {session.title || "Chat"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="mr-1 flex h-4 w-4 items-center justify-center rounded-full text-text-dim opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 transition-all"
                    title="Delete chat"
                    aria-label={`Delete ${session.title || "chat"}`}
                  >
                    <XIcon className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
          style={{ height: "calc(100% - 14rem)" }}
        >
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center max-w-[240px]">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                  <SparkleIcon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-text">
                  How can I help?
                </h3>
                <p className="mt-1 text-xs text-text-dim leading-relaxed">
                  Ask me about thumbnails, videos, translations, or anything
                  else.
                </p>
                <div className="mt-4 space-y-2">
                  {[
                    "Create a gaming thumbnail",
                    "Translate my script",
                    "Generate video ideas",
                  ].map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-text-dim hover:text-text hover:border-primary/30 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <ErrorBoundary
              key={message.id}
              fallback={
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2.5 bg-surface-elevated text-text rounded-bl-md">
                    <p className="text-[13px] text-text-muted">
                      Failed to render message. Please try again.
                    </p>
                  </div>
                </div>
              }
            >
              <MessageBubble
                message={message}
                isStreaming={isStreaming}
                parseToolAction={parseToolAction}
                router={router}
                closeWidget={closeWidget}
              />
            </ErrorBoundary>
          ))}
        </div>

        {/* Input */}
        <ChatInput />
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-[100]">
        {/* Tooltip */}
        {showTooltip && (
          <div
            className={cn(
              "absolute bottom-full right-0 mb-3",
              "whitespace-nowrap rounded-xl border border-border bg-surface px-4 py-2.5",
              "shadow-lg shadow-black/5",
              "text-sm text-text",
              "animate-in fade-in slide-in-from-bottom-2 duration-200",
            )}
            role="tooltip"
          >
            <span className="font-medium">Do you need help? Let's talk</span>
            <div className="absolute -bottom-1.5 right-6 h-2.5 w-2.5 rotate-45 border-r border-b border-border bg-surface" />
          </div>
        )}

        {/* Button */}
        {!isWidgetOpen && (
          <button
            type="button"
            onClick={handleToggle}
            onMouseEnter={() => {
              if (!isWidgetOpen && !tooltipDismissed) setShowTooltip(true);
            }}
            onMouseLeave={() => {
              setShowTooltip(false);
            }}
            className={cn(
              "group relative flex h-14 w-14 items-center justify-center rounded-full",
              "bg-primary text-white shadow-lg shadow-primary/25",
              "transition-all duration-200 ease-out",
              "hover:scale-105 hover:shadow-xl hover:shadow-primary/30",
              "active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isWidgetOpen &&
                "bg-surface-elevated text-text shadow-none hover:bg-surface",
            )}
            aria-label={isWidgetOpen ? "Close chat" : "Open chat"}
            aria-expanded={isWidgetOpen}
          >
            {/* Chat icon (when closed) */}
            <ChatBubbleIcon
              className={cn(
                "h-6 w-6 transition-transform duration-200",
                isWidgetOpen ? "rotate-90 scale-0" : "rotate-0 scale-100",
              )}
            />
            {/* Pulse ring when closed */}
            {!isWidgetOpen && (
              <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
            )}
          </button>
        )}
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}

/* ─── Chat Input (self-contained) ─── */
function ChatInput() {
  const [input, setInput] = useState("");
  const { sendMessage, isStreaming } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const committedTextRef = useRef("");

  const voice = useVoiceButton({
    language: "en",
    onPartialTranscript: (text, isFinal) => {
      if (isFinal) {
        // Utterance finalized — commit it
        committedTextRef.current =
          (committedTextRef.current ? committedTextRef.current + " " : "") +
          text;
        setInput(committedTextRef.current);
      } else {
        // Interim — show committed + current partial
        setInput(committedTextRef.current + text);
      }
    },
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
    committedTextRef.current = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-surface/80 backdrop-blur-sm px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            committedTextRef.current = e.target.value;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask me anything..."
          aria-label="Chat message"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-border bg-surface-elevated px-3.5 py-2.5 text-[13px] text-text placeholder:text-text-dim outline-none focus:border-primary/40 transition-colors"
          disabled={isStreaming}
        />
        {voice.isSupported && (
          <VoiceButton
            variant="icon"
            isListening={voice.isListening}
            isSupported={voice.isSupported}
            onToggle={voice.toggleMic}
            disabled={isStreaming}
            showCredits={false}
            className="h-10 w-10"
          />
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            "bg-primary text-white",
            "transition-all duration-150",
            "hover:bg-primary-hover",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "active:scale-95",
          )}
          aria-label="Send message"
        >
          {isStreaming ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
        </button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-text-dim">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}

/* ─── Settings Panel ─── */

function SettingsPanel({
  settings,
  userPlan,
  onUpdate,
  onClose,
}: {
  settings: {
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    reasoning: number;
  };
  userPlan: string;
  onUpdate: (
    data: Partial<{
      defaultModel: string;
      temperature: number;
      maxTokens: number;
      reasoning: number;
    }>,
  ) => void;
  onClose: () => void;
}) {
  return (
    <div className="border-b border-border bg-surface-elevated/50 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          Settings
        </span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-text-dim hover:text-text transition-colors"
          aria-label="Close settings"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Model */}
      <div className="relative">
        <label className="block text-[11px] font-medium text-text-dim mb-1.5">
          Model
        </label>
        <ProviderSelect
          toolModes={["chat", "text"]}
          value={settings.defaultModel}
          onChange={(_id, model) => {
            onUpdate({ defaultModel: model.modelId });
          }}
          label=""
        />
      </div>

      {/* Temperature */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-text-dim">
            Temperature
          </label>
          <span className="text-[11px] font-mono text-text">
            {settings.temperature.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.temperature}
          onChange={(e) =>
            onUpdate({ temperature: parseFloat(e.target.value) })
          }
          aria-label="Temperature"
          className="w-full accent-primary h-1"
        />
        <div className="mt-0.5 flex justify-between text-[9px] text-text-dim">
          <span>Precise</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Max Tokens */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-text-dim">
            Max Tokens
          </label>
          <span className="text-[11px] font-mono text-text">
            {settings.maxTokens.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min="256"
          max="16000"
          step="256"
          value={settings.maxTokens}
          onChange={(e) => onUpdate({ maxTokens: parseInt(e.target.value) })}
          aria-label="Max Tokens"
          className="w-full accent-primary h-1"
        />
      </div>

      {/* Reasoning */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-text-dim">
            Reasoning
          </label>
          <span className="text-[11px] font-mono text-text">
            {settings.reasoning.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={settings.reasoning}
          onChange={(e) => onUpdate({ reasoning: parseFloat(e.target.value) })}
          aria-label="Reasoning"
          className="w-full accent-primary h-1"
        />
        <div className="mt-0.5 flex justify-between text-[9px] text-text-dim">
          <span>Fast</span>
          <span>Deep</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─── */

function MessageBubble({
  message,
  isStreaming,
  parseToolAction,
  router,
  closeWidget,
}: {
  message: any;
  isStreaming: boolean;
  parseToolAction: (content: string) => any;
  router: any;
  closeWidget: () => void;
}) {
  const parsed =
    message.role === "assistant" && message.content
      ? parseToolAction(message.content)
      : null;

  return (
    <div
      className={cn(
        "flex",
        message.role === "user" ? "justify-end" : "justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5",
          message.role === "user"
            ? "bg-primary text-white rounded-br-md"
            : "bg-surface-elevated text-text rounded-bl-md",
        )}
      >
        {message.role === "assistant" && (
          <div className="mb-1 flex items-center gap-1">
            <SparkleIcon className="h-2.5 w-2.5 text-primary" />
            <span className="text-[9px] font-medium uppercase tracking-wider text-text-dim">
              AI
            </span>
          </div>
        )}

        {parsed?.action ? (
          <>
            {parsed.textBefore && (
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {parsed.textBefore}
              </div>
            )}
            {parsed.action.type === "route_to_tool" ? (
              <ToolActionCard
                toolId={parsed.action.toolId}
                params={parsed.action.params}
                onNavigate={(path) => {
                  router.push(path);
                  closeWidget();
                }}
              />
            ) : (
              <TweetActionCard
                draftId={parsed.action.draftId}
                content={parsed.action.content}
                topic={parsed.action.topic}
              />
            )}
            {parsed.textAfter && (
              <div className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">
                {parsed.textAfter}
              </div>
            )}
          </>
        ) : (
          <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
            {message.content ||
              (isStreaming &&
              message.role === "assistant" &&
              message.id.startsWith("assistant-") ? (
                <span className="inline-flex items-center gap-1 text-text-dim">
                  <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-primary" />
                  Making...
                </span>
              ) : null)}
            {isStreaming &&
              message.role === "assistant" &&
              message.id.startsWith("assistant-") &&
              message.content && (
                <span className="ml-0.5 inline-block h-3.5 w-px animate-pulse bg-text/50" />
              )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Tool Action Card ─── */

const TOOL_ROUTES: Record<string, { path: string; label: string }> = {
  "thumbnail-generator": {
    path: "/tools/thumbnail-generator",
    label: "Thumbnail",
  },
  thumbnail: { path: "/tools/thumbnail-generator", label: "Thumbnail" },
  "video-generator": { path: "/tools/video-generator", label: "Video" },
  video: { path: "/tools/video-generator", label: "Video" },
  "content-translator": {
    path: "/tools/content-translator",
    label: "Translate",
  },
  translator: { path: "/tools/content-translator", label: "Translate" },
  "x-search-trends": {
    path: "/tools/x-search-trends",
    label: "X Trends",
  },
  "x-post-tweet": {
    path: "/tools/x-post-tweet",
    label: "Post Tweet",
  },
};

function ToolActionCard({
  toolId,
  params,
  onNavigate,
}: {
  toolId: string;
  params?: Record<string, string>;
  onNavigate: (path: string) => void;
}) {
  const tool = TOOL_ROUTES[toolId] || {
    path: `/tools/${toolId}`,
    label: toolId,
  };
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-primary/20 bg-primary/5">
      <div className="px-3.5 py-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <SparkleIcon className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-[12px] font-semibold text-text">
              Go to {tool.label}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const qs =
              params && Object.keys(params).length > 0
                ? "?" + new URLSearchParams(params).toString()
                : "";
            onNavigate(`${tool.path}${qs}`);
          }}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-lg",
            "bg-primary px-3 py-2 text-[12px] font-semibold text-white",
            "transition-all hover:brightness-110 active:scale-[0.98]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          Open tool
          <ArrowIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Icons (SVG, no emojis — ui-ux-pro-max: no-emoji-icons) ─── */

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M11.5 2L13 8.5L19.5 7L14.5 11.5L19.5 16L13 14.5L11.5 21L10 14.5L3.5 16L8.5 11.5L3.5 7L10 8.5L11.5 2Z" />
    </svg>
  );
}

function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
