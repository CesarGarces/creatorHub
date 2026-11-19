"use client";

import { useEffect, useId, useRef, useState } from "react";
import { History, Plus, Mic, Volume2, Square } from "lucide-react";
import { Switch, cn } from "@creator-hub/ui";
import { TTS_LANGUAGES } from "@creator-hub/shared-types";
import { useIsDesktop } from "@/hooks/use-media-query";
import { TopBar } from "@/components/layout/top-bar";
import { useCreditsStore } from "@/store/credits.store";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { markdownToSafeHtml } from "@/lib/sanitize";
import { ModelSettingsPanel } from "@/components/chat/model-settings-panel";
import { VoiceButton } from "@/components/voice-button";
import { FreeMinutesNotice } from "@/components/voice-assistant/free-minutes-notice";
import { RobotinaOrb } from "@/components/voice-assistant/robotina-orb";
import { AssistantActionCard } from "@/components/voice-assistant/assistant-action-card";
import { useRobotina } from "@/hooks/use-robotina";
import {
  useVoiceAssistantStore,
  type RobotinaMessage,
} from "@/store/voice-assistant.store";
import { ORB_ACTION_KEYS, STATUS_KEYS } from "@/lib/voice-assistant/status";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import type { TranslationKey } from "@/i18n/translate";

const SUGGESTION_KEYS: TranslationKey[] = [
  "voiceAssistant.suggestions.day",
  "voiceAssistant.suggestions.idea",
  "voiceAssistant.suggestions.explain",
  "voiceAssistant.suggestions.practice",
];

/**
 * Robotina — AI voice assistant (ARCHITECTURE.md §14g). Same layout as
 * Post to X / X Trend Research: history, model settings, voice button and
 * composer. The difference: when you speak, she answers with her voice
 * (Deepgram TTS, in your language), and conversation mode keeps the
 * dialog going hands-free.
 */
export default function VoiceAssistantPage() {
  const { t, formatRelativeTime, formatDate: formatLocaleDate } = useI18n();
  const suggestions = SUGGESTION_KEYS.map((key) => t(key));
  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  // Below lg the history is an overlay drawer, closed by default.
  const isDesktop = useIsDesktop();
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const historyVisible = isDesktop ? showSidebar : mobileHistoryOpen;
  const toggleHistory = () =>
    isDesktop ? setShowSidebar((v) => !v) : setMobileHistoryOpen((v) => !v);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { fetchBalance } = useCreditsStore();
  const promptFromUrl = useToolQueryParams();
  const handsFreeId = useId();

  const {
    conversations,
    isLoadingConversations,
    activeConversationId,
    messages,
    isLoadingConversation,
    isReplying,
    settings,
    handsFree,
    fetchConversations,
    openConversation,
    newConversation,
    deleteConversation,
    updateSettings,
    setHandsFree,
  } = useVoiceAssistantStore();

  const robotina = useRobotina();
  const { state, limitReached } = robotina;
  const voiceActive = state !== "idle";

  useEffect(() => {
    fetchBalance();
    fetchConversations();
  }, [fetchBalance, fetchConversations]);

  // ?conversation=<id> opens one (e.g. from the dashboard widget).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("conversation");
    if (id) void openConversation(id);
  }, [openConversation]);

  // ?prompt=… (AI planner tool actions, chat): prefill, the user sends it.
  useEffect(() => {
    if (promptFromUrl) setInput(promptFromUrl);
  }, [promptFromUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, robotina.liveTranscript]);

  const handleSend = async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isReplying) return;
    setInput("");
    await robotina.sendText(text);
  };

  const startNew = () => {
    robotina.stop();
    newConversation();
    setInput("");
  };

  // Relative time for the last week, then a locale-formatted date.
  const formatDate = (dateStr: string) => {
    const diffDays = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
    return diffDays < 7
      ? formatRelativeTime(dateStr)
      : formatLocaleDate(dateStr, { dateStyle: "short" });
  };

  const voiceNote = (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-dim">
          {t("voiceAssistant.voiceSettings")}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {t("voiceAssistant.voiceNote")}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
          {TTS_LANGUAGES.map((language) => (
            <li
              key={language}
              className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-text-muted"
            >
              {robotina.voices[language].name} ·{" "}
              {t(`voiceAssistant.languages.${language}`)}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch
          id={handsFreeId}
          checked={handsFree}
          onCheckedChange={setHandsFree}
          aria-describedby={`${handsFreeId}-hint`}
        />
        <label htmlFor={handsFreeId} className="text-xs text-text">
          {t("voiceAssistant.handsFree")}
        </label>
        <span id={`${handsFreeId}-hint`} className="sr-only">
          {t("voiceAssistant.handsFreeHint")}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.dashboard"), href: "/dashboard" },
          { label: t("voiceAssistant.title") },
        ]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleHistory}
              aria-label={
                historyVisible
                  ? t("voiceAssistant.hideHistory")
                  : t("voiceAssistant.showHistory")
              }
              aria-expanded={historyVisible}
              className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2 text-sm text-text-muted hover:text-text transition-colors pointer-coarse:h-11 pointer-coarse:min-w-11 sm:h-auto sm:px-3 sm:py-1.5"
            >
              <History className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">
                {historyVisible
                  ? t("voiceAssistant.hideHistory")
                  : t("voiceAssistant.showHistory")}
              </span>
            </button>
            <button
              onClick={startNew}
              disabled={isReplying}
              aria-label={t("voiceAssistant.newChat")}
              className="flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2 text-sm text-text-muted hover:text-text transition-colors disabled:opacity-50 pointer-coarse:h-11 pointer-coarse:min-w-11 sm:h-auto sm:px-3 sm:py-1.5"
            >
              <Plus className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">
                {t("voiceAssistant.newChat")}
              </span>
            </button>
          </div>
        }
      />
      <div className="relative flex h-[calc(100dvh-3.5rem)]">
        {/* History: docked from lg, an overlay drawer below. */}
        {historyVisible && !isDesktop && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setMobileHistoryOpen(false)}
          />
        )}
        {historyVisible && (
          <div className="absolute inset-y-0 left-0 z-30 flex w-[85%] max-w-xs flex-col border-r border-border bg-surface shadow-2xl lg:static lg:z-auto lg:w-72 lg:max-w-none lg:shadow-none">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-medium text-text">
                {t("voiceAssistant.history")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingConversations && conversations.length === 0 ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-lg bg-surface-elevated animate-pulse"
                    />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  {t("voiceAssistant.noConversations")}
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={cn(
                      "group flex items-center gap-2 border-b border-border/50 transition-colors hover:bg-surface-elevated",
                      activeConversationId === conversation.id &&
                        "bg-surface-elevated",
                    )}
                  >
                    <button
                      type="button"
                      disabled={isReplying}
                      aria-current={
                        activeConversationId === conversation.id
                          ? "true"
                          : undefined
                      }
                      onClick={() => {
                        robotina.stop();
                        void openConversation(conversation.id);
                        if (!isDesktop) setMobileHistoryOpen(false);
                      }}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-not-allowed"
                    >
                      <div className="text-sm text-text truncate">
                        {conversation.title || t("voiceAssistant.untitled")}
                      </div>
                      {conversation.lastMessage && (
                        <div className="text-xs text-text-muted mt-0.5 truncate">
                          {conversation.lastMessage}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-300">
                          {t(
                            `voiceAssistant.languages.${conversation.language}`,
                          )}
                        </span>
                        <span className="text-[10px] text-text-dim">
                          {formatDate(conversation.updatedAt)}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void deleteConversation(conversation.id).catch(
                          () => undefined,
                        )
                      }
                      aria-label={t("voiceAssistant.deleteConversation")}
                      title={t("voiceAssistant.deleteConversation")}
                      className="mr-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 pointer-coarse:p-2.5 text-text-muted hover:text-red-400 transition-all p-1"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
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
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Model settings: the text model only — the voice is fixed. */}
          {showSettings && (
            <ModelSettingsPanel
              settings={settings}
              onUpdate={updateSettings}
              onClose={() => setShowSettings(false)}
              footer={voiceNote}
            />
          )}

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-6">
            {messages.length === 0 && !isLoadingConversation && (
              <div className="max-w-3xl mx-auto flex flex-col items-center text-center py-6 sm:py-10">
                <button
                  type="button"
                  onClick={() => void robotina.toggle()}
                  aria-label={t(ORB_ACTION_KEYS[state])}
                  data-robotina-orb
                  disabled={limitReached}
                  className="rounded-full outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-transform duration-200 ease-out hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg motion-reduce:transform-none"
                >
                  <RobotinaOrb
                    state={state}
                    getLevel={robotina.getLevel}
                    size={200}
                  />
                </button>
                <h2 className="mt-2 text-xl font-semibold text-text">
                  {t("voiceAssistant.titleLong")}
                </h2>
                <p className="mt-2 max-w-lg text-text-muted">
                  {t("voiceAssistant.emptyDescription")}
                </p>
                <p className="mt-3 text-xs text-text-dim">
                  {t("voiceAssistant.pricing", {
                    stt: robotina.sttCreditsPerSecond,
                    tts: robotina.ttsCreditsPerSecond,
                  })}
                </p>
                {!limitReached && (
                  <FreeMinutesNotice
                    allowance={robotina.allowance}
                    className="mt-1"
                  />
                )}
              </div>
            )}

            {isLoadingConversation && (
              <p className="text-center text-sm text-text-muted">
                {t("voiceAssistant.loading")}
              </p>
            )}

            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                canReplay={robotina.canReplay(msg.id)}
                onReplay={() => robotina.replay(msg.id)}
              />
            ))}

            {robotina.liveTranscript && (
              <div className="flex gap-3 sm:gap-4 max-w-3xl mx-auto flex-row-reverse">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-elevated text-text-muted">
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] sm:max-w-[80%] ml-auto border border-dashed border-primary/50 bg-primary/10 text-text italic">
                  {robotina.liveTranscript}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 0 && !voiceActive && (
            <div className="px-4 pb-4 sm:px-6">
              <div className="max-w-3xl mx-auto flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void handleSend(s)}
                    disabled={isReplying}
                    className="rounded-full border border-border bg-surface px-4 py-2 pointer-coarse:py-2.5 text-xs text-text-muted hover:text-text hover:border-primary/30 transition-all disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live voice bar: the orb while the conversation runs. */}
          {(voiceActive || (messages.length > 0 && robotina.error)) && (
            <div className="border-t border-border bg-surface-elevated/60 px-4 py-2 sm:px-6">
              <div className="max-w-3xl mx-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void robotina.toggle()}
                  aria-label={t(ORB_ACTION_KEYS[state])}
                  className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <RobotinaOrb
                    state={state}
                    getLevel={robotina.getLevel}
                    size={56}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    role="status"
                    aria-live="polite"
                    className="text-sm font-medium text-text"
                  >
                    {t(robotina.activity ?? STATUS_KEYS[state])}
                  </p>
                  {robotina.error && (
                    <p role="alert" className="text-xs text-error">
                      {robotina.error}
                    </p>
                  )}
                </div>
                {voiceActive && (
                  <button
                    type="button"
                    onClick={robotina.stop}
                    className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-text-muted hover:border-error/40 hover:text-error transition-colors"
                  >
                    <Square className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("voiceAssistant.stop")}
                  </button>
                )}
              </div>
            </div>
          )}
          {messages.length === 0 && !voiceActive && robotina.error && (
            <p
              role="alert"
              className="px-4 pb-2 text-center text-xs text-error"
            >
              {robotina.error}
            </p>
          )}

          {/* Free plan minutes used up: invite to upgrade. */}
          {limitReached && (
            <div className="px-4 pb-3 sm:px-6">
              <FreeMinutesNotice
                allowance={robotina.allowance}
                className="mx-auto max-w-3xl"
              />
            </div>
          )}

          {/* Input */}
          <div
            data-composer
            className="border-t border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4"
          >
            {/* Phones: message + send on top, tool buttons below. */}
            <div className="max-w-3xl mx-auto flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl border transition-colors flex-shrink-0",
                  showSettings
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-elevated text-text-muted hover:text-text hover:border-primary/30",
                )}
                title={t("voiceAssistant.modelSettings")}
                aria-label={t("voiceAssistant.modelSettings")}
                aria-expanded={showSettings}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              {robotina.isVoiceSupported && (
                <VoiceButton
                  variant="icon"
                  isListening={state === "listening"}
                  isSupported={robotina.isVoiceSupported}
                  onToggle={() => void robotina.toggle()}
                  disabled={limitReached && state === "idle"}
                  className={cn(
                    state === "speaking" &&
                      "border-fuchsia-500/50 bg-fuchsia-500/10 text-fuchsia-300",
                  )}
                />
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && !e.shiftKey && void handleSend()
                }
                placeholder={t("voiceAssistant.inputPlaceholder")}
                aria-label={t("voiceAssistant.inputPlaceholder")}
                disabled={isReplying || limitReached}
                className="order-first min-w-0 flex-1 basis-[calc(100%-3.25rem)] rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary transition-colors disabled:opacity-50 sm:order-none sm:basis-auto"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isReplying || limitReached}
                aria-label={t("voiceAssistant.send")}
                className="order-first flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary sm:order-none text-primary-foreground hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
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

function MessageBubble({
  message,
  canReplay,
  onReplay,
}: {
  message: RobotinaMessage;
  canReplay: boolean;
  onReplay: () => void;
}) {
  const { t } = useI18n();
  const isAssistant = message.role === "assistant";

  if (
    isAssistant &&
    message.streaming &&
    !message.content &&
    !message.actions?.length
  ) {
    return (
      <div className="flex gap-4 max-w-3xl mx-auto">
        <RobotinaAvatar />
        <div className="rounded-2xl px-5 py-3.5 bg-surface border border-border">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="w-2 h-2 bg-fuchsia-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
            <span className="text-sm text-text-muted">
              {t("voiceAssistant.status.thinking")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 sm:gap-4 max-w-3xl mx-auto animate-slide-up",
        !isAssistant && "flex-row-reverse",
      )}
    >
      {isAssistant ? (
        <RobotinaAvatar />
      ) : (
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm text-text-muted"
          aria-label={t("voiceAssistant.you")}
          role="img"
        >
          {message.spoken ? (
            <Mic className="h-4 w-4" aria-hidden="true" />
          ) : (
            "👤"
          )}
        </div>
      )}
      <div
        className={cn(
          "min-w-0 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 text-sm leading-relaxed max-w-[85%] sm:max-w-[80%]",
          isAssistant
            ? "bg-surface border border-border text-text"
            : "bg-primary text-primary-foreground ml-auto",
        )}
      >
        {message.content && (
          <div
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{
              __html: markdownToSafeHtml(message.content),
            }}
          />
        )}
        {message.actions?.map((action) => (
          <AssistantActionCard
            key={action.id}
            action={action}
            className={message.content ? "mt-3" : undefined}
          />
        ))}
        {message.error && (
          <p role="alert" className="mt-1 text-error">
            {localizeError(message.error, "voiceAssistant.errors.replyFailed")}
          </p>
        )}
        {isAssistant && !message.streaming && !message.error && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-dim">
            {canReplay && (
              <button
                type="button"
                onClick={onReplay}
                className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-text-muted hover:border-fuchsia-400/50 hover:text-fuchsia-300 transition-colors pointer-coarse:min-h-11"
              >
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("voiceAssistant.replay")}
              </button>
            )}
            {message.spoken && !canReplay && (
              <span className="inline-flex items-center gap-1">
                <Volume2 className="h-3 w-3" aria-hidden="true" />
                {t("voiceAssistant.spoken")}
              </span>
            )}
            {message.interrupted && (
              <span>{t("voiceAssistant.interrupted")}</span>
            )}
            {message.voiceFailed && (
              <span>
                {message.voiceFailed === "credits"
                  ? t("voiceAssistant.voiceOutOfCredits")
                  : message.voiceFailed === "free-limit"
                    ? t("voiceAssistant.voiceOutOfFreeMinutes")
                    : t("voiceAssistant.voiceFailed")}
              </span>
            )}
            {message.credits > 0 && (
              <span>
                {t("voiceAssistant.credits", { count: message.credits })}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RobotinaAvatar() {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 via-indigo-500 to-fuchsia-500 text-sm shadow-[0_0_12px_rgba(217,70,239,0.35)]"
    >
      🤖
    </div>
  );
}
