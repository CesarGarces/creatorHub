"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { cn } from "@creator-hub/ui";
import { useSocialResearchStore } from "@/store/social-research.store";
import { sanitizeHtml } from "@/lib/sanitize";
import {
  ModelSettingsPanel,
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
} from "@/components/chat/model-settings-panel";
import { VoiceButton, useVoiceButton } from "@/components/voice-button";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import type { TranslationKey } from "@/i18n/translate";

const SUGGESTION_KEYS: TranslationKey[] = [
  "xResearch.suggestions.ai",
  "xResearch.suggestions.crypto",
  "xResearch.suggestions.web3",
  "xResearch.suggestions.startups",
];

/** Escapes text inserted into the HTML string below. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function XSearchTrendsPage() {
  const router = useRouter();
  const { t, tOptional, formatNumber: formatLocaleNumber } = useI18n();
  const suggestions = SUGGESTION_KEYS.map((key) => t(key));
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { fetchBalance, plan } = useCreditsStore();
  const promptFromUrl = useToolQueryParams();
  const [showSidebar, setShowSidebar] = useState(true);
  const [settings, setSettings] = useState<ModelSettings>(
    DEFAULT_MODEL_SETTINGS,
  );
  const [showSettings, setShowSettings] = useState(false);

  const {
    sessions,
    activeSession,
    isSearching,
    error,
    fetchSessions,
    selectSession,
    createSession,
    deleteSession,
    search,
    clearActiveSession,
  } = useSocialResearchStore();

  const isFreePlan = plan === "FREE";
  const messages = activeSession?.messages || [];

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
    fetchSessions("x-search-trends");
  }, [fetchBalance, fetchSessions]);

  useEffect(() => {
    if (promptFromUrl && !isFreePlan) {
      handleSend(promptFromUrl);
    }
  }, [promptFromUrl, isFreePlan]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isFreePlan) {
    return (
      <>
        <TopBar
          breadcrumbs={[
            { label: t("nav.dashboard"), href: "/dashboard" },
            { label: t("xResearch.title") },
          ]}
        />
        <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] p-6">
          <div className="max-w-md text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 mx-auto mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-amber-500"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text mb-2">
              {t("xResearch.title")}
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                {t("xResearch.pro")}
              </span>
            </h2>
            <p className="text-text-muted mb-6">
              {t("xResearch.upgradeDescription")}
            </p>
            <button
              onClick={() => router.push("/credits")}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
            >
              {t("xResearch.upgradePlan")}
            </button>
          </div>
        </div>
      </>
    );
  }

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim() || isSearching) return;
    committedTextRef.current = "";
    setInput("");
    try {
      const title = text.slice(0, 50);
      if (!activeSession) {
        await createSession("x-search-trends", title);
      }
      await search(
        "x-search-trends",
        {
          topic: text,
          maxTweets: 50,
          timeframe: "24h",
        },
        title,
      );
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  // Compact, locale-aware counts: 1.2K / 1,2 mil / 1,2 mil.
  const formatNumber = (num: number) =>
    formatLocaleNumber(num, { notation: "compact", maximumFractionDigits: 1 });

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "text-green-500";
      case "negative":
        return "text-red-500";
      default:
        return "text-text-muted";
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "🟢";
      case "negative":
        return "🔴";
      default:
        return "⚪";
    }
  };

  const getAuthorityBadge = (authority: string) => {
    switch (authority) {
      case "high":
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full">
            {t("xResearch.influencer")}
          </span>
        );
      case "medium":
        return (
          <span className="inline-flex items-center gap-0.5 text-[10px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded-full">
            {t("xResearch.active")}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("xResearch.title") },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              {showSidebar
                ? t("xResearch.hideHistory")
                : t("xResearch.showHistory")}
            </button>
            <button
              onClick={() => {
                clearActiveSession();
                setInput("");
              }}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text-muted hover:text-text transition-colors"
            >
              {t("xResearch.newSearch")}
            </button>
          </div>
        }
      />
      <div className="flex h-[calc(100vh-3.5rem)]">
        {showSidebar && (
          <div className="w-72 border-r border-border bg-surface flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-medium text-text">
                {t("xResearch.searchHistory")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  {t("xResearch.noSearches")}
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
                        {session.title || t("xResearch.untitledSearch")}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {t("xResearch.messages", {
                          count:
                            session._count?.messages ||
                            session.messages?.length ||
                            0,
                        })}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      aria-label={t("xResearch.deleteSearch")}
                      title={t("xResearch.deleteSearch")}
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
                  {t("xResearch.title")}
                  <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-500">
                    {t("xResearch.pro")}
                  </span>
                </h2>
                <p className="text-text-muted mb-8">
                  {t("xResearch.emptyDescription")}
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-4 max-w-4xl mx-auto animate-slide-up",
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
                    "rounded-2xl px-5 py-3.5 text-sm leading-relaxed max-w-[85%]",
                    msg.role === "assistant"
                      ? "bg-surface border border-border text-text"
                      : "bg-primary text-white ml-auto",
                  )}
                >
                  <div
                    className="whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(
                        msg.content
                          .replace(
                            /\[View on X →\]\((.*?)\)/g,
                            `<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${escapeHtml(t("xResearch.viewOnX"))}</a>`,
                          )
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\n/g, "<br/>"),
                      ),
                    }}
                  />

                  {msg.role === "assistant" &&
                    msg.resultData?.tweets &&
                    msg.resultData.tweets.length > 0 && (
                      <div className="mt-4">
                        {/* Analysis Summary */}
                        {msg.resultData.analysis && (
                          <div className="mb-4 p-3 bg-surface-elevated rounded-lg border border-border">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-text">
                                {t("xResearch.analysisSummary")}
                              </span>
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full",
                                  msg.resultData.analysis.overallSentiment ===
                                    "positive"
                                    ? "bg-green-500/10 text-green-500"
                                    : msg.resultData.analysis
                                          .overallSentiment === "negative"
                                      ? "bg-red-500/10 text-red-500"
                                      : "bg-gray-500/10 text-gray-500",
                                )}
                              >
                                {getSentimentIcon(
                                  msg.resultData.analysis.overallSentiment,
                                )}{" "}
                                {tOptional(
                                  `xResearch.sentiment.${msg.resultData.analysis.overallSentiment}`,
                                  msg.resultData.analysis.overallSentiment.toUpperCase(),
                                )}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted">
                              {msg.resultData.analysis.executiveSummary}
                            </p>
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-text-muted">
                            {t("xResearch.tweetsFound", {
                              count: msg.resultData.tweetCount,
                            })}
                            {msg.resultData.originalTweetCount >
                              msg.resultData.tweetCount && (
                              <span className="text-text-dim">
                                {t("xResearch.filteredFrom", {
                                  count: msg.resultData.originalTweetCount,
                                })}
                              </span>
                            )}
                          </span>
                          {msg.cacheHit && (
                            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                              {t("xResearch.cached")}
                            </span>
                          )}
                          {msg.resultData.fromCache && (
                            <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full">
                              {t("xResearch.fromCache")}
                            </span>
                          )}
                        </div>

                        {/* Key Themes */}
                        {msg.resultData.analysis &&
                          msg.resultData.analysis.themes &&
                          msg.resultData.analysis.themes.length > 0 && (
                            <div className="mb-3">
                              <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                                {t("xResearch.keyThemes")}
                              </span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {msg.resultData.analysis.themes
                                  .slice(0, 5)
                                  .map((theme: any) => (
                                    <span
                                      key={theme.name}
                                      className={cn(
                                        "text-[10px] px-2 py-0.5 rounded-full",
                                        theme.sentiment === "positive"
                                          ? "bg-green-500/10 text-green-500"
                                          : theme.sentiment === "negative"
                                            ? "bg-red-500/10 text-red-500"
                                            : "bg-surface-elevated text-text-muted",
                                      )}
                                    >
                                      {theme.name} ({theme.tweetCount})
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}

                        {/* Tweets Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border border-border rounded-lg overflow-hidden">
                            <thead className="bg-surface-elevated">
                              <tr>
                                <th className="px-3 py-2 text-left text-text-muted font-medium">
                                  {t("xResearch.table.author")}
                                </th>
                                <th className="px-3 py-2 text-left text-text-muted font-medium">
                                  {t("xResearch.table.tweet")}
                                </th>
                                <th className="px-3 py-2 text-right text-text-muted font-medium">
                                  {t("xResearch.table.likes")}
                                </th>
                                <th className="px-3 py-2 text-right text-text-muted font-medium">
                                  {t("xResearch.table.retweets")}
                                </th>
                                <th className="px-3 py-2 text-right text-text-muted font-medium">
                                  {t("xResearch.table.replies")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {msg.resultData.tweets.map(
                                (tweet: any, i: number) => (
                                  <tr
                                    key={tweet.id || i}
                                    className="border-t border-border hover:bg-surface-elevated/50"
                                  >
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1.5">
                                        <a
                                          href={`https://x.com/${tweet.author?.username}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium text-primary hover:underline"
                                        >
                                          @
                                          {tweet.author?.username ||
                                            t("xResearch.unknownAuthor")}
                                        </a>
                                        {tweet.author?.verified && (
                                          <svg
                                            width="12"
                                            height="12"
                                            viewBox="0 0 24 24"
                                            fill="#1d9bf0"
                                          >
                                            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
                                          </svg>
                                        )}
                                      </div>
                                      <div className="text-text-muted">
                                        {t("xResearch.followers", {
                                          count: formatNumber(
                                            tweet.author?.followers || 0,
                                          ),
                                        })}
                                      </div>
                                      {getAuthorityBadge(tweet.authority)}
                                    </td>
                                    <td className="px-3 py-2 max-w-xs">
                                      <a
                                        href={`https://x.com/${tweet.author?.username}/status/${tweet.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-text hover:text-primary hover:underline line-clamp-2"
                                      >
                                        {tweet.text}
                                      </a>
                                      {tweet.hashtags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {tweet.hashtags
                                            .slice(0, 3)
                                            .map((tag: string, j: number) => (
                                              <span
                                                key={j}
                                                className="text-primary text-[10px]"
                                              >
                                                #{tag}
                                              </span>
                                            ))}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-text-muted">
                                      {formatNumber(tweet.metrics?.likes || 0)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-text-muted">
                                      {formatNumber(
                                        tweet.metrics?.retweets || 0,
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-right text-text-muted">
                                      {formatNumber(
                                        tweet.metrics?.replies || 0,
                                      )}
                                    </td>
                                  </tr>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}

            {error && (
              <div className="flex gap-4 max-w-4xl mx-auto">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500 text-sm">
                  ⚠️
                </div>
                <div className="rounded-2xl px-5 py-3.5 bg-red-500/5 border border-red-500/20 text-sm text-red-400">
                  {localizeError(error, "xResearch.searchFailed")}
                </div>
              </div>
            )}

            {isSearching && (
              <div className="flex gap-4 max-w-4xl mx-auto">
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
                      {t("xResearch.analyzing")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {messages.length === 0 && (
            <div className="px-6 pb-4">
              <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    disabled={isSearching}
                    className="rounded-full border border-border bg-surface px-4 py-2 text-xs text-text-muted hover:text-text hover:border-primary/30 transition-all disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                title={t("xResearch.modelSettings")}
                aria-label={t("xResearch.modelSettings")}
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
                  disabled={isSearching}
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
                placeholder={t("xResearch.inputPlaceholder")}
                disabled={isSearching}
                className="flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isSearching}
                aria-label={t("xResearch.send")}
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
