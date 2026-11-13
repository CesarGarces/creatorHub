"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToolsStore } from "@/store/tools.store";
import { useCreditsStore } from "@/store/credits.store";
import { useVideoStore } from "@/store/video.store";
import api from "@/lib/api";
import {
  Button,
  Badge,
  EmptyState,
  LoadingSpinner,
  Switch,
  Tooltip,
} from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { LiquidEtherBackground } from "@/components/animations";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { ProviderSelect } from "@/components/provider-select";
import { Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";

const videoAspectRatios = [
  { id: "16:9", label: "16:9", width: 1280, height: 720, iconClass: "w-8 h-5" },
  { id: "9:16", label: "9:16", width: 720, height: 1280, iconClass: "w-5 h-8" },
  { id: "1:1", label: "1:1", width: 720, height: 720, iconClass: "w-8 h-8" },
];

// Quality options by model type
const QUALITY_OPTIONS = {
  default: [
    { id: "480p", label: "480p" },
    { id: "720p", label: "720p" },
  ],
  seedance2: [
    { id: "480p", label: "480p" },
    { id: "720p", label: "720p" },
    { id: "1080p", label: "1080p" },
    { id: "4k", label: "4K" },
  ],
} as const;

const planVariants: Record<string, "free" | "primary" | "premium"> = {
  FREE: "free",
  PAY_AS_YOU_GO: "primary",
  PREMIUM: "premium",
  STARTER: "primary",
  PRO: "premium",
};

export default function VideoGeneratorPage() {
  const router = useRouter();
  const { t, tOptional } = useI18n();
  const { tools, fetchTools } = useToolsStore();
  const {
    balance,
    plan,
    isLoading: creditsLoading,
    isHydrated: creditsHydrated,
    fetchBalance,
  } = useCreditsStore();
  const {
    status,
    resultUrl: videoUrl,
    resultId: videoId,
    error: generationError,
    prompt,
    aiProvider,
    aspectRatio,
    model,
    imageUrl,
    duration,
    audioEnabled,
    quality,
    variations,
    setPrompt,
    setAiProvider,
    setAspectRatio,
    setModel,
    setImageUrl,
    setDuration,
    setAudioEnabled,
    setQuality,
    startGeneration,
    setRevealing,
    setReady,
    setFailed,
    addVariation,
    reset,
    resetAll,
  } = useVideoStore();

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showVariations, setShowVariations] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const lastCompletedRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isI2V = model === "Wan-AI/Wan2.2-I2V-A14B";

  // Detect Seedance models for advanced settings
  const isSeedance = model.toLowerCase().includes("seedance");
  const isSeedance2 =
    model.toLowerCase().includes("seedance-2") ||
    model.toLowerCase().includes("seedance2");
  const supportsAdvancedSettings = isSeedance;
  const qualityOptions = isSeedance2
    ? QUALITY_OPTIONS.seedance2
    : QUALITY_OPTIONS.default;

  // Calculate dynamic credits: cost per second × duration
  const [selectedModelCreditCost, setSelectedModelCreditCost] = useState(50);
  const estimatedCredits = supportsAdvancedSettings
    ? selectedModelCreditCost * duration
    : selectedModelCreditCost;

  const promptFromUrl = useToolQueryParams();

  useEffect(() => {
    fetchTools();
    fetchBalance();
  }, [fetchTools, fetchBalance]);

  useEffect(() => {
    if (promptFromUrl) {
      setPrompt(promptFromUrl);
    }
  }, [promptFromUrl, setPrompt]);

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
    if (
      creditsHydrated &&
      !creditsLoading &&
      balance === 0 &&
      plan === "FREE"
    ) {
      setShowUpgradeModal(true);
    }
  }, [creditsHydrated, creditsLoading, balance, plan]);

  useEffect(() => {
    if (
      status === "READY" &&
      videoUrl &&
      lastCompletedRef.current !== videoUrl
    ) {
      lastCompletedRef.current = videoUrl;
      addVariation(videoUrl, videoId || "");
    }
  }, [status, videoUrl, videoId, addVariation]);

  useEffect(() => {
    if (model !== "Wan-AI/Wan2.2-I2V-A14B") {
      setImageUrl(null);
    }
  }, [model, setImageUrl]);

  const _tool = tools.find((t) => t.id === "video-generator");
  const isProcessing = status === "GENERATING" || status === "REVEALING";
  const selectedDimensions =
    videoAspectRatios.find((ar) => ar.id === aspectRatio) ||
    videoAspectRatios[0]!;

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("video.selectImageFile"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("video.imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ success: boolean; data: { jobId: string } }>(
        "/tools/video-generator/generate",
        {
          prompt,
          model,
          provider: aiProvider,
          aspectRatio,
          imageUrl: isI2V ? imageUrl : undefined,
        },
      );
    },
    onSuccess: (response) => {
      const jobId = response?.data?.jobId;
      if (!jobId) {
        toast.error(t("toolShared.noJobId"));
        return;
      }
      lastCompletedRef.current = null;
      startGeneration("video-generator", jobId);
    },
    onError: (error: any) => {
      const message = localizeError(error, "video.failed");
      setFailed(message);
      toast.error(message);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    if (isI2V && !imageUrl) {
      toast.error(t("video.sourceImageRequired"));
      return;
    }
    const payload = {
      prompt,
      model,
      provider: aiProvider,
      aspectRatio,
      imageUrl: isI2V ? imageUrl : undefined,
      duration: supportsAdvancedSettings ? duration : undefined,
      audioEnabled: supportsAdvancedSettings ? audioEnabled : undefined,
      quality: supportsAdvancedSettings ? quality : undefined,
    };
    reset();
    generateMutation.reset();
    api
      .post<{ success: boolean; data: { jobId: string } }>(
        "/tools/video-generator/generate",
        payload,
      )
      .then((response) => {
        const jobId = response?.data?.jobId;
        if (!jobId) {
          toast.error(t("toolShared.noJobId"));
          return;
        }
        lastCompletedRef.current = null;
        startGeneration("video-generator", jobId);
      })
      .catch((error: any) => {
        const message = localizeError(error, "video.failed");
        setFailed(message);
        toast.error(message);
      });
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: t("nav.tools"), href: "/tools" },
          { label: t("toolCatalog.video-generator.name") },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {variations.length > 0 && (
              <button
                onClick={() => setShowVariations(!showVariations)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                  showVariations
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-elevated text-text-muted hover:border-primary/50 hover:bg-primary/5"
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
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                {t("toolShared.variations")}
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs">
                  {variations.length}
                </span>
              </button>
            )}
            <Badge variant="primary" size="sm">
              {t("common.credits.cost", { count: estimatedCredits })}
              {supportsAdvancedSettings && (
                <span className="text-[10px] ml-1 opacity-70">
                  {t("video.costBreakdown", {
                    cost: selectedModelCreditCost,
                    duration,
                  })}
                </span>
              )}
            </Badge>
            {plan && planVariants[plan] && (
              <Badge variant={planVariants[plan]} size="sm">
                {tOptional(`common.plans.${plan}`, plan)}
              </Badge>
            )}
          </div>
        }
      />
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Left Panel - Controls */}
        <div className="w-80 border-r border-border bg-surface p-5 space-y-6 overflow-y-auto flex-shrink-0">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              {t("toolShared.prompt")}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t("video.promptPlaceholder")}
              disabled={isProcessing}
              className="w-full h-32 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Image Upload - Only for I2V model */}
          {isI2V && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                {t("video.sourceImage")}
              </label>
              {imageUrl ? (
                <div className="relative rounded-lg border border-border bg-surface-elevated overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={t("video.sourceImageAlt")}
                    className="w-full h-40 object-contain bg-black/20"
                  />
                  <button
                    onClick={() => setImageUrl(null)}
                    disabled={isProcessing}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-text-muted hover:text-text hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={t("toolShared.removeImage")}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                  <div className="px-3 py-2 border-t border-border">
                    <p className="text-[11px] text-text-dim truncate">
                      {t("video.imageLoaded")}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-all cursor-pointer ${
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-surface-elevated/50"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${isDragOver ? "bg-primary/10" : "bg-surface-elevated"}`}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-text-dim"
                    >
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
                      <line x1="16" x2="22" y1="5" y2="5" />
                      <line x1="19" x2="19" y1="2" y2="8" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium text-text-muted">
                      {isDragOver
                        ? t("video.dropHere")
                        : t("video.dragOrClick")}
                    </p>
                    <p className="text-[11px] text-text-dim mt-0.5">
                      {t("video.fileHint")}
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">
              {t("toolShared.aspectRatio")}
            </label>
            <div
              className="flex gap-1.5"
              role="radiogroup"
              aria-label={t("toolShared.aspectRatioGroup")}
            >
              {videoAspectRatios.map((ar) => {
                const isSelected = aspectRatio === ar.id;
                return (
                  <button
                    key={ar.id}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={t("toolShared.aspectRatioOption", {
                      ratio: ar.label,
                    })}
                    onClick={() => !isProcessing && setAspectRatio(ar.id)}
                    disabled={isProcessing}
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-w-[48px] h-16 ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface-elevated text-text-dim hover:border-primary/50 hover:bg-primary/5 hover:text-text-muted"
                    }`}
                  >
                    <div
                      className={`rounded-sm transition-colors ${
                        isSelected ? "bg-primary" : "bg-current opacity-30"
                      }`}
                      style={{
                        width: ar.id === "1:1" || ar.id === "16:9" ? 24 : 14,
                        height: ar.id === "1:1" || ar.id === "9:16" ? 24 : 14,
                      }}
                    />
                    <span className="text-[11px] font-semibold leading-none">
                      {ar.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <ProviderSelect
            toolModes={["video"]}
            value={model}
            onChange={(_modelId, m) => {
              setModel(m.modelId);
              setAiProvider(m.providerSlug);
              setSelectedModelCreditCost(m.creditCost);
            }}
            disabled={isProcessing}
            label={t("video.videoModel")}
          />

          {/* Advanced Settings - Only for Seedance models */}
          {supportsAdvancedSettings && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("video.advancedSettings")}
              </div>

              {/* Duration Slider */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="duration-slider"
                    className="text-xs font-medium text-text-dim"
                  >
                    {t("video.duration")}
                  </label>
                  <span className="text-xs font-mono text-text tabular-nums">
                    {duration}s
                  </span>
                </div>
                <input
                  id="duration-slider"
                  type="range"
                  min="4"
                  max="15"
                  step="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  disabled={isProcessing}
                  className="w-full accent-primary h-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="mt-1 flex justify-between text-[10px] text-text-dim">
                  <span>4s</span>
                  <span>15s</span>
                </div>
              </div>

              {/* Audio Switch */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="audio-switch"
                  className="text-xs font-medium text-text-dim flex items-center gap-2"
                >
                  {audioEnabled ? (
                    <Volume2 size={16} className="text-primary" />
                  ) : (
                    <VolumeX size={16} className="text-text-dim" />
                  )}
                  {t("video.audio")}
                </label>
                <Switch
                  id="audio-switch"
                  checked={audioEnabled}
                  onCheckedChange={setAudioEnabled}
                  disabled={isProcessing}
                />
              </div>

              {/* Quality Selector */}
              <div>
                <label className="text-xs font-medium text-text-dim mb-2 block">
                  {t("video.quality")}
                </label>
                <div
                  className="flex gap-1.5"
                  role="radiogroup"
                  aria-label={t("video.qualityGroup")}
                >
                  {qualityOptions.map((q) => {
                    const isSelected = quality === q.id;
                    return (
                      <button
                        key={q.id}
                        role="radio"
                        aria-checked={isSelected}
                        aria-label={t("video.qualityOption", {
                          quality: q.label,
                        })}
                        onClick={() => !isProcessing && setQuality(q.id)}
                        disabled={isProcessing}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-surface-elevated text-text-dim hover:border-primary/50 hover:bg-primary/5"
                        }`}
                      >
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              isLoading={isProcessing}
              disabled={
                !prompt.trim() ||
                !creditsHydrated ||
                balance < estimatedCredits ||
                isProcessing ||
                (isI2V && !imageUrl)
              }
              onClick={handleGenerate}
            >
              {isProcessing
                ? t("common.actions.generating")
                : t("video.generate")}
            </Button>
            {creditsHydrated && balance < estimatedCredits && (
              <p className="mt-2 text-xs text-error text-center">
                {t("video.insufficientCreditsNeed", {
                  count: estimatedCredits,
                })}{" "}
                <button
                  onClick={() => router.push("/credits")}
                  className="underline cursor-pointer"
                >
                  {t("toolShared.buyMore")}
                </button>
              </p>
            )}
          </div>

          {creditsHydrated &&
            !creditsLoading &&
            balance === 0 &&
            plan === "FREE" && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-warning">⚠️</span>
                  <span className="text-sm font-medium text-warning">
                    {t("toolShared.noCreditsTitle")}
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  {t("toolShared.noCreditsDescription")}
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  {t("toolShared.recharge")}
                </Button>
              </div>
            )}
        </div>

        {/* Center - Preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg overflow-hidden">
          <div
            className="relative"
            style={{
              aspectRatio: `${selectedDimensions.width} / ${selectedDimensions.height}`,
              maxWidth: "100%",
              maxHeight: "100%",
              width:
                selectedDimensions.height > selectedDimensions.width
                  ? "auto"
                  : "100%",
              height:
                selectedDimensions.height > selectedDimensions.width
                  ? "100%"
                  : "auto",
            }}
          >
            <LiquidEtherBackground />

            {status === "IDLE" && !videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <EmptyState
                  icon="🎬"
                  title={t("video.emptyTitle")}
                  description={t("video.emptyDescription")}
                />
              </div>
            )}

            {(status === "GENERATING" || status === "REVEALING") && (
              <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                <LoadingSpinner
                  text={t("video.generatingLabel")}
                  colors={["#c084fc", "#f472b6", "#38bdf8"]}
                />
              </div>
            )}

            {(status === "REVEALING" || status === "READY") && videoUrl && (
              <div className="absolute inset-0 flex flex-col justify-center space-y-4 animate-fade-in">
                <div
                  className={`relative rounded-xl overflow-hidden border border-border transition-opacity duration-700 ${
                    status === "READY" ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <video
                    src={videoUrl}
                    controls
                    className="w-full h-full object-contain"
                    autoPlay
                    loop
                  />
                </div>
                {status === "READY" && (
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await fetch(videoUrl);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "video.mp4";
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success(t("common.toasts.downloadStarted"));
                        } catch {
                          toast.error(t("common.toasts.downloadFailed"));
                        }
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                      {t("common.actions.download")}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(videoUrl);
                        toast.success(t("common.toasts.urlCopied"));
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      {t("common.actions.copyUrl")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={resetAll}>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      {t("common.actions.generateNew")}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {status === "FAILED" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4 animate-fade-in">
                  <div className="rounded-xl border border-error/30 bg-error/5 p-8">
                    <p className="text-error font-medium">
                      {t("toolShared.generationFailed")}
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      {generationError
                        ? localizeError(generationError)
                        : t("common.status.unknownError")}
                    </p>
                    {!generationError?.includes("content filter") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={handleGenerate}
                      >
                        {t("common.actions.tryAgain")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Variations Drawer */}
      {showVariations && (
        <div
          className="fixed inset-0 z-[99998] bg-black/60 transition-opacity duration-300"
          onClick={() => setShowVariations(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-[85vw] max-w-sm bg-surface border-l border-border shadow-2xl z-[99999] transition-transform duration-300 ease-out ${
          showVariations ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between flex-shrink-0 px-6 pt-6 pb-4 border-b border-border">
            <h2 className="text-lg font-semibold text-text">
              {t("toolShared.variations")}
            </h2>
            <button
              onClick={() => setShowVariations(false)}
              aria-label={t("common.actions.close")}
              className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-muted"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
            {variations.length > 0 ? (
              variations.map((v, i) => (
                <div
                  key={v.url || i}
                  className={`rounded-lg overflow-hidden border cursor-pointer transition-all ${
                    videoUrl === v.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-border/80"
                  }`}
                  style={{
                    aspectRatio: `${selectedDimensions.width} / ${selectedDimensions.height}`,
                  }}
                  onClick={() => {
                    setRevealing(v.url, v.videoId);
                    setReady();
                    setShowVariations(false);
                  }}
                >
                  <video
                    src={v.url}
                    className="w-full h-full object-contain"
                    muted
                  />
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-xs text-text-dim">
                {t("toolShared.variationsEmpty")}
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}
