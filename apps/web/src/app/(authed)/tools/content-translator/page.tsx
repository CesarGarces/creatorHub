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
import { VoiceButton, useVoiceButton } from "@/components/voice-button";
import api from "@/lib/api";
import { TopBar } from "@/components/layout/top-bar";
import { LiquidEtherBackground } from "@/components/animations";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { ProviderSelect } from "@/components/provider-select";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

const planVariants: Record<string, "free" | "primary" | "premium"> = {
  FREE: "free",
  PAY_AS_YOU_GO: "primary",
  PREMIUM: "premium",
  STARTER: "primary",
  PRO: "premium",
};

// Target languages for translation. Names are rendered in the interface
// language via Intl.DisplayNames (e.g. "fr" → "French" / "Francés").
const LANGUAGE_CODES = [
  "es",
  "en",
  "fr",
  "de",
  "zh",
  "ja",
  "ko",
  "pt",
  "it",
  "ru",
  "ar",
  "nl",
  "pl",
  "tr",
  "hi",
  "vi",
  "th",
  "sv",
];

export default function ContentTranslatorPage() {
  const router = useRouter();
  const { t, tOptional, formatLanguageName } = useI18n();
  const LANGUAGES = LANGUAGE_CODES.map((code) => ({
    code,
    label: formatLanguageName(code),
  }));
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

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [selectedModelCost, setSelectedModelCost] = useState<number>(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showNewDictationConfirm, setShowNewDictationConfirm] = useState(false);

  const langDropdownRef = useRef<HTMLDivElement>(null);

  const isProcessing = status === "GENERATING" || status === "REVEALING";
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

  const {
    toggleMic: voiceToggleMic,
    isSupported,
    startListening,
  } = useVoiceButton({
    language: targetLanguage,
    onPartialTranscript: handlePartialTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onResult: handleSTTResult,
    onError: handleSTTError,
    externalIsListening: isListening,
    setExternalListening: setListening,
  });

  const toggleMic = useCallback(async () => {
    if (isListening) {
      voiceToggleMic();
    } else {
      if (inputText.trim()) {
        setShowNewDictationConfirm(true);
        return;
      }
      await voiceToggleMic();
    }
  }, [isListening, inputText, voiceToggleMic]);

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
        toast.error(t("translator.noJobId"));
        return;
      }
      startTranslation("content-translator", jobId);
    },
    onError: (error: any) => {
      const message = localizeError(error, "translator.failed");
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
      toast.success(t("translator.copied"));
    }
  };

  const selectedLangLabel = selectedLanguage
    ? t("translator.translateTo", { language: selectedLanguage.label })
    : t("translator.selectLanguage");

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.tools"), href: "/tools" },
          { label: t("toolCatalog.content-translator.name") },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {selectedModelCost > 0 && (
              <Badge variant="primary" size="sm">
                {t("common.credits.count", { count: selectedModelCost })}
              </Badge>
            )}
            {plan && planVariants[plan] && (
              <Badge variant={planVariants[plan]} size="sm">
                {tOptional(`common.plans.${plan}`, plan)}
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
            <VoiceButton
              variant="icon-text"
              isListening={isListening}
              isSupported={isSupported}
              onToggle={toggleMic}
              disabled={isProcessing}
            />
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
                aria-label={t("translator.targetLanguage")}
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

          <ProviderSelect
            toolModes={["translation"]}
            value={provider}
            onChange={(_modelId, model) => {
              setProvider(model.modelId);
              setSelectedModelCost(model.creditCost);
            }}
            disabled={isProcessing}
          />

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="glow"
              size="lg"
              disabled={
                !inputText.trim() ||
                !creditsHydrated ||
                balance < (selectedModelCost || 1) ||
                isProcessing
              }
              onClick={handleTranslate}
              isLoading={isProcessing}
            >
              {isProcessing
                ? t("translator.translating")
                : t("translator.translate")}
            </Button>
          </div>
        </div>

        {/* Text areas */}
        <div className="relative z-10 flex flex-1 min-h-0">
          {(status === "GENERATING" || status === "REVEALING") && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-bg/60 backdrop-blur-sm animate-fade-in">
              <LoadingSpinner
                size="lg"
                text={t("translator.translatingContent")}
                colors={["#c084fc", "#f472b6", "#38bdf8"]}
              />
            </div>
          )}

          {/* Input */}
          <div className="flex-1 flex flex-col border-r border-border">
            <div className="px-4 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("translator.sourceText")}
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
                    ? t("translator.speakNow")
                    : t("translator.inputPlaceholder")
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
                {t("translator.translation")}
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
                  {t("common.actions.copy")}
                </button>
              )}
            </div>
            <div className="flex-1 relative">
              {status === "IDLE" && !outputText && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-text-dim">
                    {t("translator.outputPlaceholder")}
                  </p>
                </div>
              )}

              {status === "FAILED" && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className="text-center space-y-4 animate-fade-in">
                    <div className="rounded-xl border border-error/30 bg-error/5 p-6 max-w-sm">
                      <p className="text-error font-medium">
                        {t("translator.failedTitle")}
                      </p>
                      <p className="text-sm text-text-muted mt-1">
                        {translationError
                          ? localizeError(translationError)
                          : t("common.status.unknownError")}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={handleTranslate}
                      >
                        {t("common.actions.tryAgain")}
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
          balance < (selectedModelCost || 1) &&
          status === "IDLE" && (
            <div className="relative z-10 px-6 py-2">
              <p className="text-xs text-error text-center">
                {t("toolShared.insufficientCredits")}{" "}
                <button
                  onClick={() => router.push("/credits")}
                  className="underline cursor-pointer"
                >
                  {t("toolShared.buyMore")}
                </button>
              </p>
            </div>
          )}
      </div>

      <ActionConfirmDialog
        isOpen={showNewDictationConfirm}
        onClose={() => setShowNewDictationConfirm(false)}
        onConfirm={handleNewDictationConfirm}
        title={t("translator.newDictation.title")}
        description={t("translator.newDictation.description")}
        confirmLabel={t("translator.newDictation.confirm")}
        cancelLabel={t("translator.newDictation.cancel")}
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
