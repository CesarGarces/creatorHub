"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { cn } from "@creator-hub/ui";
import api from "@/lib/api";
import { markdownToSafeHtml } from "@/lib/sanitize";
import {
  ModelSettingsPanel,
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
} from "@/components/chat/model-settings-panel";
import {
  useTweetDraftsStore,
  type TweetDraftSession,
} from "@/store/tweet-drafts.store";
import { VoiceButton, useVoiceButton } from "@/components/voice-button";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import type { TranslationKey, TranslationParams } from "@/i18n/translate";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  /**
   * For app-generated assistant messages: rendered with t() at display time
   * so they follow interface-language changes.
   */
  contentKey?: TranslationKey;
  contentParams?: TranslationParams;
  draft?: {
    id: string;
    content: string;
    status: string;
  };
  isStreaming?: boolean;
}

const SUGGESTION_KEYS: TranslationKey[] = [
  "xPost.suggestions.aiTrends",
  "xPost.suggestions.launch",
  "xPost.suggestions.web3",
  "xPost.suggestions.motivation",
];

export default function XPostTweetPage() {
  const router = useRouter();
  const {
    t,
    tOptional,
    formatRelativeTime,
    formatDate: formatLocaleDate,
  } = useI18n();
  const suggestions = SUGGESTION_KEYS.map((key) => t(key));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [settings, setSettings] = useState<ModelSettings>(
    DEFAULT_MODEL_SETTINGS,
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { fetchBalance, plan } = useCreditsStore();
  const promptFromUrl = useToolQueryParams();

  const {
    sessions,
    activeSession,
    isLoading: isLoadingSessions,
    fetchSessions,
    selectSession,
    deleteSession,
    createSession,
    clearActiveSession,
    updateSessionStatus,
  } = useTweetDraftsStore();

  const isFreePlan = plan === "FREE";

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
    fetchSessions();
  }, [fetchBalance, fetchSessions]);

  useEffect(() => {
    if (promptFromUrl && !isFreePlan) {
      handleSend(promptFromUrl);
    }
  }, [promptFromUrl, isFreePlan]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (activeSession) {
      setMessages([
        {
          id: `user-${activeSession.id}`,
          role: "user",
          content: activeSession.topic,
        },
        {
          id: `assistant-${activeSession.id}`,
          role: "assistant",
          content: "",
          contentKey: "xPost.draftIntro",
          draft: {
            id: activeSession.id,
            content: activeSession.content,
            status: activeSession.status,
          },
        },
      ]);
    } else {
      setMessages([]);
    }
  }, [activeSession]);

  if (isFreePlan) {
    return (
      <>
        <TopBar
          breadcrumbs={[
            { label: t("nav.dashboard"), href: "/dashboard" },
            { label: t("xPost.title") },
          ]}
        />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] p-6">
          <div className="max-w-md text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mx-auto mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-amber-500"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">
              {t("xPost.title")}
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                {t("xPost.pro")}
              </span>
            </h2>
            <p className="text-text-muted mb-6">
              {t("xPost.upgradeDescription")}
            </p>
            <button
              onClick={() => router.push("/credits")}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
            >
              {t("xPost.upgradePlan")}
            </button>
          </div>
        </div>
      </>
    );
  }

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isStreaming) return;
    committedTextRef.current = "";
    setInput("");

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
        success: boolean;
        data: { id: string; content: string; status: string; topic: string };
      }>("/social/tweets/draft", {
        topic: text,
        instructions: text,
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      const draft = response.data;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        contentKey: "xPost.draftIntro",
        draft: {
          id: draft.id,
          content: draft.content,
          status: draft.status,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Add to sessions store
      createSession({
        id: draft.id,
        topic: draft.topic || text,
        content: draft.content,
        status: draft.status as TweetDraftSession["status"],
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        contentKey: "xPost.generateError",
        contentParams: {
          error: localizeError(error, "xPost.generateFailed"),
        },
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handlePublish = async (draftId: string) => {
    setPublishing(draftId);
    try {
      const response = await api.post<{
        success: boolean;
        data: { tweetId: string; tweetUrl: string };
      }>(`/social/tweets/drafts/${draftId}/publish`);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.draft?.id === draftId
            ? {
                ...msg,
                draft: { ...msg.draft, status: "PUBLISHED" },
                content: "",
                contentKey: "xPost.published" as TranslationKey,
              }
            : msg,
        ),
      );

      updateSessionStatus(draftId, "PUBLISHED", response.data.tweetId);
    } catch (error: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "",
          contentKey: "xPost.publishFailed",
          contentParams: {
            error: localizeError(error, "xPost.publishFailedHint"),
          },
        },
      ]);
      updateSessionStatus(draftId, "FAILED");
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
    } catch (error: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "",
          contentKey: "xPost.editFailed",
          contentParams: { error: localizeError(error) },
        },
      ]);
    }
  };

  // Relative time for the last week, then a locale-formatted date.
  const formatDate = (dateStr: string) => {
    const diffDays = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
    return diffDays < 7
      ? formatRelativeTime(dateStr)
      : formatLocaleDate(dateStr, { dateStyle: "short" });
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("xPost.title") },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              {showSidebar ? t("xPost.hideHistory") : t("xPost.showHistory")}
            </button>
            <button
              onClick={() => {
                clearActiveSession();
                setMessages([]);
                setInput("");
              }}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              {t("xPost.newTweet")}
            </button>
          </div>
        }
      />
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* History Sidebar */}
        {showSidebar && (
          <div className="w-72 border-r border-border bg-surface flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-medium text-text">
                {t("xPost.tweetHistory")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingSessions ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-surface-elevated animate-pulse"
                    />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  {t("xPost.noTweets")}
                </div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-border/50 hover:bg-surface-elevated transition-colors",
                      activeSession?.id === session.id && "bg-surface-elevated",
                    )}
                    onClick={() => selectSession(session.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text truncate">
                        {session.topic || t("xPost.untitled")}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5 truncate">
                        {session.content?.slice(0, 50) || t("xPost.draft")}...
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full",
                            session.status === "PUBLISHED"
                              ? "bg-green-500/10 text-green-500"
                              : session.status === "FAILED"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-blue-500/10 text-blue-500",
                          )}
                        >
                          {tOptional(
                            `xPost.status.${session.status}`,
                            session.status,
                          )}
                        </span>
                        <span className="text-[10px] text-text-dim">
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      aria-label={t("xPost.deleteDraft")}
                      title={t("xPost.deleteDraft")}
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
          {/* Settings Panel */}
          {showSettings && (
            <ModelSettingsPanel
              settings={settings}
              onUpdate={(partial) =>
                setSettings((prev) => ({ ...prev, ...partial }))
              }
              onClose={() => setShowSettings(false)}
            />
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
                    fill="currentColor"
                    className="text-text"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-text mb-2">
                  {t("xPost.titleLong")}
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                    {t("xPost.pro")}
                  </span>
                </h2>
                <p className="text-text-muted mb-8">
                  {t("xPost.emptyDescription")}
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
                      __html: markdownToSafeHtml(
                        msg.contentKey
                          ? t(msg.contentKey, msg.contentParams)
                          : msg.content,
                      ),
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
                      {t("xPost.generating")}
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
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors flex-shrink-0",
                  showSettings
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-elevated text-text-muted hover:text-text hover:border-primary/30",
                )}
                title={t("xPost.modelSettings")}
                aria-label={t("xPost.modelSettings")}
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
              {voice.isSupported && (
                <VoiceButton
                  variant="icon"
                  isListening={voice.isListening}
                  isSupported={voice.isSupported}
                  onToggle={voice.toggleMic}
                  disabled={isStreaming}
                />
              )}
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  committedTextRef.current = e.target.value;
                }}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && handleSend()
                }
                placeholder={t("xPost.inputPlaceholder")}
                disabled={isStreaming}
                className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isStreaming}
                aria-label={t("xPost.send")}
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
  const { t } = useI18n();
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
              {t("xPost.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={isOverLimit}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              {t("xPost.save")}
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
        <span className="text-xs text-text-muted">
          {t("xPost.chars", { count: charCount })}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted hover:text-text transition-colors"
          >
            {t("xPost.edit")}
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
              ? t("xPost.publishedButton")
              : isPublishing
                ? t("xPost.publishing")
                : t("xPost.publish")}
          </button>
        </div>
      </div>
    </div>
  );
}
