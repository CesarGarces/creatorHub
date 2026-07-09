"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Badge,
  LoadingSpinner,
  ActionConfirmDialog,
} from "@creator-hub/ui";
import { useCreditsStore } from "@/store/credits.store";
import { useTranslatorStore } from "@/store/translator.store";
import { useLiveSpeechToText } from "@/hooks/use-live-speech-to-text";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { LiquidEtherBackground } from "@/components/animations";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";

const planLabels: Record<
  string,
  { label: string; variant: "free" | "primary" | "premium" }
> = {
  FREE: { label: "FREE PLAN", variant: "free" },
  PAY_AS_YOU_GO: { label: "PAY AS YOU GO", variant: "primary" },
  PREMIUM: { label: "PREMIUM", variant: "premium" },
  STARTER: { label: "STARTER", variant: "primary" },
  PRO: { label: "PRO", variant: "premium" },
};

const LANGUAGES = [
  { code: "es", label: "Spanish" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "tr", label: "Turkish" },
  { code: "hi", label: "Hindi" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "sv", label: "Swedish" },
];

type ProviderFromApi = {
  id: string;
  name: string;
  displayName: string;
  tier: "free" | "pro";
  costPerCredit: number;
  model: string;
  supportedTasks: string[];
};

export default function ContentTranslatorPage() {
  const router = useRouter();
  const {
    balance,
    plan,
    isLoading: creditsLoading,
    isHydrated: creditsHydrated,
    fetchBalance,
  } = useCreditsStore();
  const {
    status,
    inputText,
    targetLanguage,
    provider,
    outputText,
    error: translationError,
    isListening,
    liveTranscript,
    liveTranscriptFinal,
    setInputText,
    setTargetLanguage,
    setProvider,
    startTranslation,
    setFailed,
    setListening,
    appendLiveTranscript,
    commitLiveTranscript,
    reset,
  } = useTranslatorStore();

  const [providers, setProviders] = useState<ProviderFromApi[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isProviderOpen, setIsProviderOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showNewDictationConfirm, setShowNewDictationConfirm] = useState(false);

  const langDropdownRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);

  const isProcessing = status === "GENERATING" || status === "REVEALING";
  const selectedProvider = providers.find((p) => p.id === provider);
  const selectedLanguage = LANGUAGES.find((l) => l.code === targetLanguage);

  const displayText = inputText + (liveTranscript ? " " + liveTranscript : "");

  const handlePartialTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      console.log("[STT:partial]", isFinal ? "(final)" : "(interim)", text);
      appendLiveTranscript(text, isFinal);
    },
    [appendLiveTranscript],
  );

  const handleUtteranceEnd = useCallback(() => {
    commitLiveTranscript();
  }, [commitLiveTranscript]);

  const handleSTTResult = useCallback(
    (_fullTranscript: string, _durationMs: number, _credits: number) => {
      setListening(false);
      commitLiveTranscript();
      fetchBalance();
    },
    [setListening, commitLiveTranscript, fetchBalance],
  );

  const handleSTTError = useCallback(
    (error: string) => {
      setListening(false);
      toast.error(error);
    },
    [setListening],
  );

  const { startListening, stopListening, isSupported } = useLiveSpeechToText({
    language: targetLanguage,
    onPartialTranscript: handlePartialTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onResult: handleSTTResult,
    onError: handleSTTError,
  });

  const playStartSound = () => {
    const audio = new Audio("/Voice_record_start.mp3");
    audio.play().catch(() => {});
  };

  const playEndSound = () => {
    const audio = new Audio("/Voice_record_end.mp3");
    audio.play().catch(() => {});
  };

  const toggleMic = useCallback(async () => {
    if (isListening) {
      playEndSound();
      setListening(false);
      stopListening();
    } else {
      if (inputText.trim()) {
        setShowNewDictationConfirm(true);
        return;
      }
      playStartSound();
      setListening(true);
      await startListening();
    }
  }, [isListening, inputText, stopListening, setListening, startListening]);

  const handleNewDictationConfirm = useCallback(async () => {
    setShowNewDictationConfirm(false);
    useTranslatorStore.setState({
      inputText: "",
      outputText: "",
      liveTranscript: "",
      liveTranscriptFinal: "",
      status: "IDLE",
      error: null,
    });
    playStartSound();
    setListening(true);
    await startListening();
  }, [setListening, startListening]);

  const promptFromUrl = useToolQueryParams();

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    if (promptFromUrl) {
      setInputText(promptFromUrl);
    }
  }, [promptFromUrl, setInputText]);

  // Cleanup URL params on unmount
  useEffect(() => {
    return () => {
      // Clear any remaining URL params when leaving the page
      const url = new URL(window.location.href);
      url.searchParams.delete("prompt");
      url.searchParams.delete("description");
      window.history.replaceState({}, "", url.pathname);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        langDropdownRef.current &&
        !langDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLangOpen(false);
      }
      if (
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProviderOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (
      creditsHydrated &&
      !creditsLoading &&
      balance === 0 &&
      plan === "FREE" &&
      status === "IDLE"
    ) {
      setShowUpgradeModal(true);
    }
  }, [creditsHydrated, creditsLoading, balance, plan, status]);

  useEffect(() => {
    api
      .get<ProviderFromApi[]>("/ai/providers")
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const translatorProviders = list.filter((p) =>
            p.supportedTasks?.includes("translator"),
          );
          setProviders(translatorProviders);

          const firstProvider = translatorProviders[0];
          const validIds = new Set(translatorProviders.map((p) => p.id));
          if (firstProvider && !validIds.has(provider)) {
            setProvider(firstProvider.id);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load providers", err);
      })
      .finally(() => {
        setProvidersLoading(false);
      });
  }, []);

  const translateMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ success: boolean; data: { jobId: string } }>(
        "/tools/content-translator/translate",
        { text: inputText, targetLanguage, provider },
      );
    },
    onSuccess: (response) => {
      const jobId = response?.data?.jobId;
      if (!jobId) {
        toast.error("Translation failed: no job ID returned");
        return;
      }
      startTranslation("content-translator", jobId);
    },
    onError: (error: any) => {
      const message =
        error?.message || "Failed to translate. Please try again.";
      setFailed(message);
      toast.error(message);
    },
  });

  const handleTranslate = () => {
    if (!inputText.trim()) return;
    reset();
    translateMutation.reset();
    translateMutation.mutate();
  };

  const handleCopy = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
      toast.success("Translation copied to clipboard");
    }
  };

  const selectedLangLabel = selectedLanguage
    ? `Translate to: ${selectedLanguage.label}`
    : "Select language";

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Tools", href: "/tools" },
          { label: "Content Translator" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {selectedProvider && (
              <Badge variant="primary" size="sm">
                {selectedProvider.costPerCredit} credits
              </Badge>
            )}
            {plan && planLabels[plan] && (
              <Badge variant={planLabels[plan].variant} size="sm">
                {planLabels[plan].label}
              </Badge>
            )}
          </div>
        }
      />

      <div className="flex flex-col h-[calc(100vh-3.5rem)] relative">
        <LiquidEtherBackground />

        {/* Header controls */}
        <div className="relative z-30 flex items-center gap-3 px-6 py-3 border-b border-border bg-bg/80 backdrop-blur-sm flex-shrink-0">
          {/* Mic button — first in the bar */}
          {isSupported && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={isProcessing}
              className={`relative flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isListening
                  ? "border-red-500/50 bg-red-500/15 text-red-400"
                  : "border-border bg-surface-elevated text-text-muted hover:text-text hover:border-primary/50 hover:bg-primary/5"
              }`}
              title={isListening ? "Stop recording" : "Start voice input"}
            >
              {isListening ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
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
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
              <span className="text-xs">
                {isListening ? "Listening..." : "Voice"}
              </span>
              {isListening && (
                <>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
                  <span className="text-[10px] text-red-400/80 ml-0.5">
                    +1 cr/min
                  </span>
                </>
              )}
            </button>
          )}

          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => !isProcessing && setIsLangOpen((v) => !v)}
              disabled={isProcessing}
              aria-haspopup="listbox"
              aria-expanded={isLangOpen}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[220px] ${
                isLangOpen
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface-elevated text-text hover:border-primary/50 hover:bg-primary/5"
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" x2="22" y1="12" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span className="truncate">{selectedLangLabel}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`ml-auto transition-transform duration-200 ${
                  isLangOpen ? "rotate-180" : ""
                }`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isLangOpen && (
              <div
                className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-xl animate-fade-in"
                role="listbox"
                aria-label="Target language"
              >
                {LANGUAGES.map((lang) => {
                  const isSelected = targetLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isProcessing}
                      onClick={() => {
                        if (isProcessing) return;
                        setTargetLanguage(lang.code);
                        setIsLangOpen(false);
                      }}
                      className={`flex w-full items-center px-3 py-2.5 text-sm text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-surface text-text"
                      }`}
                    >
                      <span className="font-medium">{lang.label}</span>
                      <span className="ml-auto text-xs text-text-muted">
                        {lang.code.toUpperCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative" ref={providerDropdownRef}>
            {providersLoading ? (
              <div className="h-11 w-52 rounded-lg bg-surface-elevated animate-pulse" />
            ) : providers.length === 0 ? (
              <p className="text-xs text-text-dim">
                No text providers available.
              </p>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => !isProcessing && setIsProviderOpen((v) => !v)}
                  disabled={isProcessing}
                  aria-haspopup="listbox"
                  aria-expanded={isProviderOpen}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[220px] ${
                    isProviderOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-elevated text-text hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">
                      {selectedProvider?.displayName ||
                        selectedProvider?.name ||
                        "AI Provider"}
                    </span>
                    {selectedProvider?.tier === "pro" && (
                      <Badge variant="premium" size="sm">
                        PRO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    {selectedProvider && (
                      <span className="text-xs text-text-muted tabular-nums">
                        {selectedProvider.costPerCredit} cr
                      </span>
                    )}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`ml-auto transition-transform duration-200 ${
                        isProviderOpen ? "rotate-180" : ""
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isProviderOpen && (
                  <div
                    className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-xl animate-fade-in"
                    role="listbox"
                    aria-label="AI Model"
                  >
                    {providers.map((p) => {
                      const isSelected = provider === p.id;
                      const isDisabled =
                        isProcessing || (p.tier === "pro" && plan === "FREE");
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            setProvider(p.id);
                            setIsProviderOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-3 text-sm text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            isSelected
                              ? "bg-primary/10 text-primary"
                              : "hover:bg-surface text-text"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate">
                              {p.displayName || p.name}
                            </span>
                            {p.tier === "pro" && (
                              <Badge variant="premium" size="sm">
                                PRO
                              </Badge>
                            )}
                            {isDisabled && p.tier === "pro" && (
                              <span className="text-[10px] text-text-dim whitespace-nowrap">
                                (upgrade)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs text-text-muted tabular-nums">
                              {p.costPerCredit} cr
                            </span>
                            {isSelected && (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-primary"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="glow"
              size="lg"
              disabled={
                !inputText.trim() ||
                !creditsHydrated ||
                balance < (selectedProvider?.costPerCredit ?? 1) ||
                isProcessing
              }
              onClick={handleTranslate}
              isLoading={isProcessing}
            >
              {isProcessing ? "Translating..." : "Translate"}
            </Button>
          </div>
        </div>

        {/* Text areas */}
        <div className="relative z-10 flex flex-1 min-h-0">
          {(status === "GENERATING" || status === "REVEALING") && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-bg/60 backdrop-blur-sm animate-fade-in">
              <LoadingSpinner
                size="lg"
                text="Translating content..."
                colors={["#c084fc", "#f472b6", "#38bdf8"]}
              />
            </div>
          )}

          {/* Input */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Source Text
              </span>
            </div>
            <div className="flex-1 relative">
              <textarea
                value={displayText}
                onChange={(e) => {
                  if (!isListening) {
                    setInputText(e.target.value);
                  }
                }}
                placeholder={
                  isListening
                    ? "Speak now..."
                    : "Paste or type the text you want to translate..."
                }
                disabled={isProcessing}
                className="absolute inset-0 w-full h-full resize-none bg-transparent px-5 py-4 text-sm text-text placeholder:text-text-dim outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col">
            <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Translation
              </span>
              {selectedLanguage && (
                <span className="text-xs text-text-dim">
                  ({selectedLanguage.label})
                </span>
              )}
              {outputText && status === "READY" && (
                <button
                  onClick={handleCopy}
                  className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text hover:bg-surface-elevated transition-colors cursor-pointer"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </button>
              )}
            </div>
            <div className="flex-1 relative">
              {status === "IDLE" && !outputText && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-text-dim">
                    Translation will appear here
                  </p>
                </div>
              )}

              {status === "FAILED" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="text-center space-y-4 animate-fade-in">
                    <div className="rounded-xl border border-error/30 bg-error/5 p-6 max-w-sm">
                      <p className="text-error font-medium">
                        Translation failed
                      </p>
                      <p className="text-sm text-text-muted mt-1">
                        {translationError || "Unknown error"}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={handleTranslate}
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <textarea
                value={outputText || ""}
                readOnly
                className="absolute inset-0 w-full h-full resize-none bg-transparent px-5 py-4 text-sm text-text outline-none"
              />
            </div>
          </div>
        </div>

        {creditsHydrated &&
          balance < (selectedProvider?.costPerCredit ?? 1) &&
          status === "IDLE" && (
            <div className="relative z-10 px-6 py-2">
              <p className="text-xs text-error text-center">
                Insufficient credits.{" "}
                <button
                  onClick={() => router.push("/credits")}
                  className="underline cursor-pointer"
                >
                  Buy more
                </button>
              </p>
            </div>
          )}
      </div>

      <ActionConfirmDialog
        isOpen={showNewDictationConfirm}
        onClose={() => setShowNewDictationConfirm(false)}
        onConfirm={handleNewDictationConfirm}
        title="New Dictation"
        description="There's an existing dictation that will be replaced. Do you want to start a new one?"
        confirmLabel="Yes, start new"
        cancelLabel="No, keep current"
        confirmVariant="primary"
        icon={
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        }
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}
