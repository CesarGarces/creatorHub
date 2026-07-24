"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";
import { cn } from "@creator-hub/ui";
import {
  ModelSettingsPanel,
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
} from "@/components/chat/model-settings-panel";
import { VoiceButton, useVoiceButton } from "@/components/voice-button";
import {
  useScriptWriterStore,
  type ScriptMessage,
} from "@/store/script-writer.store";

const PLATFORMS = [
  { value: "youtube-long", label: "YouTube Long (8-15 min)" },
  { value: "youtube-short", label: "YouTube Shorts" },
  { value: "tiktok", label: "TikTok" },
  { value: "reels", label: "Instagram Reels" },
] as const;

const TONES = [
  { value: "emotional", label: "Emotional" },
  { value: "controversial", label: "Controversial" },
  { value: "analytical", label: "Analytical" },
  { value: "comedic", label: "Comedic" },
  { value: "direct", label: "Direct & Fast" },
] as const;

const HOOK_TYPES = [
  { value: "mystery", label: "Mystery / Uncertainty" },
  { value: "shocking-data", label: "Shocking Data" },
  { value: "rhetorical-question", label: "Rhetorical Question" },
  { value: "contradiction", label: "Contradiction" },
] as const;

const SUGGESTIONS = [
  "Write a script about why AI will change everything",
  "TikTok script about an anime character with a dark secret",
  "Script about 5 habits that make you more productive",
  "Controversial script about why remote work is better than office",
];

const PLATFORM_ICONS: Record<string, string> = {
  "youtube-long": "YT",
  "youtube-short": "YS",
  tiktok: "TT",
  reels: "IG",
  shorts: "YS",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ScriptWriterPage() {
  const {
    messages,
    scripts,
    isGenerating,
    config,
    showSidebar,
    sendMessage,
    fetchScripts,
    selectScript,
    deleteScript,
    setConfig,
    toggleSidebar,
    clearChat,
  } = useScriptWriterStore();

  const [input, setInput] = useState("");
  const [settings, setSettings] = useState<ModelSettings>(
    DEFAULT_MODEL_SETTINGS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showScriptConfig, setShowScriptConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { fetchBalance } = useCreditsStore();

  const committedTextRef = useRef("");

  const voice = useVoiceButton({
    language: "en",
    onPartialTranscript: (text, isFinal) => {
      if (isFinal) {
        committedTextRef.current =
          (committedTextRef.current ? committedTextRef.current + " " : "") +
          text;
        setInput(committedTextRef.current);
      } else {
        setInput(committedTextRef.current + text);
      }
    },
  });

  useEffect(() => {
    fetchBalance();
    fetchScripts();
  }, [fetchBalance, fetchScripts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    (text?: string) => {
      const message = text || input;
      if (!message.trim() || isGenerating) return;
      committedTextRef.current = "";
      setInput("");
      sendMessage(message, settings);
    },
    [input, isGenerating, sendMessage, settings],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Script Writer" },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              {showSidebar ? "Hide History" : "Show History"}
            </button>
            <button
              onClick={() => {
                clearChat();
                setInput("");
              }}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              New Script
            </button>
          </div>
        }
      />
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* History Sidebar */}
        {showSidebar && (
          <div className="w-72 border-r border-border bg-surface flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-medium text-text">Script History</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {scripts.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  No scripts yet
                </div>
              ) : (
                scripts.map((script) => (
                  <div
                    key={script.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-surface-elevated transition-colors",
                    )}
                    onClick={() => selectScript(script.id)}
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary/10 text-primary text-[10px] font-bold flex-shrink-0">
                      {PLATFORM_ICONS[script.platform] || "SC"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text truncate">
                        {script.title || script.topic}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {script.estimatedDuration && (
                          <span className="text-[10px] text-text-muted">
                            ~{formatDuration(script.estimatedDuration)}
                          </span>
                        )}
                        <span className="text-[10px] text-text-dim">
                          {formatDate(script.createdAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteScript(script.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-500 transition-all p-1"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Model Settings Panel */}
          {showSettings && (
            <ModelSettingsPanel
              settings={settings}
              onUpdate={(partial) =>
                setSettings((prev) => ({ ...prev, ...partial }))
              }
              onClose={() => setShowSettings(false)}
            />
          )}

          {/* Script Config Panel */}
          {showScriptConfig && (
            <div className="border-b border-border bg-surface-elevated/50">
              <div className="max-w-3xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-text-dim"
                    >
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" x2="8" y1="13" y2="13" />
                      <line x1="16" x2="8" y1="17" y2="17" />
                      <line x1="10" x2="8" y1="9" y2="9" />
                    </svg>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
                      Script Configuration
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScriptConfig(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface transition-all cursor-pointer"
                    aria-label="Close script config"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" x2="6" y1="6" y2="18" />
                      <line x1="6" x2="18" y1="6" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1.5">
                      Platform
                    </label>
                    <select
                      value={config.platform}
                      onChange={(e) => setConfig({ platform: e.target.value })}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-primary transition-colors"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1.5">
                      Tone
                    </label>
                    <select
                      value={config.tone}
                      onChange={(e) => setConfig({ tone: e.target.value })}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-primary transition-colors"
                    >
                      {TONES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1.5">
                      Hook
                    </label>
                    <select
                      value={config.hookType}
                      onChange={(e) => setConfig({ hookType: e.target.value })}
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-primary transition-colors"
                    >
                      {HOOK_TYPES.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-dim mb-1.5">
                      Duration (sec)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={900}
                      value={config.targetDuration}
                      onChange={(e) =>
                        setConfig({
                          targetDuration: parseInt(e.target.value) || 300,
                        })
                      }
                      className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="max-w-3xl mx-auto text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-4">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    <path d="m15 5 4 4" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text mb-2">
                  Script Writer
                </h2>
                <p className="text-text-muted mb-8">
                  Generate structured scripts with hook, development, climax and
                  CTA
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isGenerating &&
              messages.length > 0 &&
              messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-4 max-w-3xl mx-auto">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
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
                        Generating script...
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
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    disabled={isGenerating}
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
              {/* Gear icon = Model Settings */}
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors flex-shrink-0",
                  showSettings
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-elevated text-text-muted hover:text-text hover:border-primary/30",
                )}
                title="Model settings"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {/* Voice button */}
              {voice.isSupported && (
                <VoiceButton
                  variant="icon"
                  isListening={voice.isListening}
                  isSupported={voice.isSupported}
                  onToggle={voice.toggleMic}
                  disabled={isGenerating}
                />
              )}

              {/* Script config toggle (hamburger menu) */}
              <button
                onClick={() => setShowScriptConfig((v) => !v)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors flex-shrink-0",
                  showScriptConfig
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-elevated text-text-muted hover:text-text hover:border-primary/30",
                )}
                title="Script configuration"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="16" y1="12" y2="12" />
                  <line x1="4" x2="12" y1="18" y2="18" />
                </svg>
              </button>

              {/* Input */}
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  committedTextRef.current = e.target.value;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Describe your script topic..."
                disabled={isGenerating}
                className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary transition-colors disabled:opacity-50"
              />

              {/* Send */}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isGenerating}
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
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: ScriptMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [message.content]);

  return (
    <div
      className={cn(
        "flex gap-4 max-w-3xl mx-auto animate-slide-up",
        isUser && "flex-row-reverse",
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm",
          isUser
            ? "bg-surface-elevated text-text-muted"
            : "bg-primary text-white",
        )}
      >
        {isUser ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
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
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        )}
      </div>
      <div
        className={cn(
          "rounded-2xl px-5 py-3.5 text-sm leading-relaxed max-w-[80%]",
          isUser
            ? "bg-primary text-white ml-auto"
            : "bg-surface border border-border text-text",
        )}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ScriptContent
            message={message}
            copied={copied}
            onCopy={handleCopy}
          />
        )}
      </div>
    </div>
  );
}

function ScriptContent({
  message,
  copied,
  onCopy,
}: {
  message: ScriptMessage;
  copied: boolean;
  onCopy: () => void;
}) {
  if (message.isStreaming && !message.content) {
    return (
      <div className="flex items-center gap-2 py-2">
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
        <span className="text-sm text-text-muted">Generating script...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="whitespace-pre-wrap text-sm">{message.content}</div>

      {message.isStreaming && (
        <div className="flex items-center gap-2 mt-2 py-1">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          <span className="text-xs text-text-muted">Generating...</span>
        </div>
      )}

      {!message.isStreaming &&
        message.content &&
        !message.content.startsWith("Error:") && (
          <div className="mt-3 pt-3 border-t border-border/50">
            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {message.duration && (
                <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  ~{formatDuration(message.duration)}
                </span>
              )}
              {message.wordCount && (
                <span className="text-[11px] text-text-muted">
                  {message.wordCount} words
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:text-text hover:border-primary/30 transition-colors"
              >
                {copied ? (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={onCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[11px] text-text-muted hover:text-text hover:border-primary/30 transition-colors"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                Export
              </button>
            </div>

            {/* Thumbnail Prompt */}
            {message.thumbnailPrompt && (
              <div className="mt-3 p-2.5 rounded-lg bg-surface-elevated border border-border/50">
                <div className="text-[10px] font-medium text-text-muted mb-1 uppercase tracking-wide">
                  Thumbnail Prompt
                </div>
                <p className="text-xs text-text leading-relaxed">
                  {message.thumbnailPrompt}
                </p>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
