"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToolsStore } from "@/store/tools.store";
import { useCreditsStore } from "@/store/credits.store";
import { useVideoStore } from "@/store/video.store";
import api from "@/lib/api";
import { Button, Badge, EmptyState, LoadingSpinner } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { LiquidEtherBackground } from "@/components/animations";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { ProviderSelect } from "@/components/provider-select";

const videoAspectRatios = [
  { id: "16:9", label: "16:9", width: 1280, height: 720, iconClass: "w-8 h-5" },
  { id: "9:16", label: "9:16", width: 720, height: 1280, iconClass: "w-5 h-8" },
  { id: "1:1", label: "1:1", width: 720, height: 720, iconClass: "w-8 h-8" },
];

const videoModels = [
  {
    id: "Wan-AI/Wan2.2-T2V-A14B",
    label: "Text to Video",
    modelId: "Wan-AI/Wan2.2-T2V-A14B",
    description: "Generate videos from text prompts",
    emoji: "📝",
  },
  {
    id: "Wan-AI/Wan2.2-I2V-A14B",
    label: "Image to Video",
    modelId: "Wan-AI/Wan2.2-I2V-A14B",
    description: "Animate images into videos",
    emoji: "🖼️",
  },
];

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

export default function VideoGeneratorPage() {
  const router = useRouter();
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
    variations,
    setPrompt,
    setAiProvider,
    setAspectRatio,
    setModel,
    setImageUrl,
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
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
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
        toast.error("Generation failed: no job ID returned");
        return;
      }
      lastCompletedRef.current = null;
      startGeneration("video-generator", jobId);
    },
    onError: (error: any) => {
      const message =
        error?.message || "Failed to generate video. Please try again.";
      setFailed(message);
      toast.error(message);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    if (isI2V && !imageUrl) {
      toast.error("Please upload a source image for Image-to-Video");
      return;
    }
    const payload = {
      prompt,
      model,
      provider: aiProvider,
      aspectRatio,
      imageUrl: isI2V ? imageUrl : undefined,
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
          toast.error("Generation failed: no job ID returned");
          return;
        }
        lastCompletedRef.current = null;
        startGeneration("video-generator", jobId);
      })
      .catch((error: any) => {
        const message =
          error?.message || "Failed to generate video. Please try again.";
        setFailed(message);
        toast.error(message);
      });
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Tools", href: "/tools" },
          { label: "Video Generator" },
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
                Variations
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs">
                  {variations.length}
                </span>
              </button>
            )}
            <Badge variant="primary" size="sm">
              ⚡ 50 credits
            </Badge>
            {plan && planLabels[plan] && (
              <Badge variant={planLabels[plan].variant} size="sm">
                {planLabels[plan].label}
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
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to create..."
              disabled={isProcessing}
              className="w-full h-32 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">
              Video Model
            </label>
            <div className="space-y-2">
              {videoModels.map((m) => (
                <button
                  key={m.id}
                  onClick={() => !isProcessing && setModel(m.id)}
                  disabled={isProcessing}
                  className={`flex items-center gap-3 w-full rounded-lg border p-3 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    model === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-elevated text-text-muted hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <span className="text-lg">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-[11px] text-text-dim font-mono truncate">
                      {m.modelId}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload - Only for I2V model */}
          {isI2V && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">
                Source Image
              </label>
              {imageUrl ? (
                <div className="relative rounded-lg border border-border bg-surface-elevated overflow-hidden">
                  <img
                    src={imageUrl}
                    alt="Source image"
                    className="w-full h-40 object-contain bg-black/20"
                  />
                  <button
                    onClick={() => setImageUrl(null)}
                    disabled={isProcessing}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 text-text-muted hover:text-text hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Remove image"
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
                      Image loaded
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
                      {isDragOver ? "Drop image here" : "Drag & drop or click"}
                    </p>
                    <p className="text-[11px] text-text-dim mt-0.5">
                      PNG, JPG, WEBP up to 10MB
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
              Aspect Ratio
            </label>
            <div
              className="flex gap-1.5"
              role="radiogroup"
              aria-label="Aspect ratio selection"
            >
              {videoAspectRatios.map((ar) => {
                const isSelected = aspectRatio === ar.id;
                return (
                  <button
                    key={ar.id}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${ar.label} aspect ratio`}
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
            value={aiProvider}
            onChange={(_modelId, model) => setAiProvider(model.providerSlug)}
            disabled={isProcessing}
            label="AI Provider"
          />

          <div className="pt-2">
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              isLoading={isProcessing}
              disabled={
                !prompt.trim() ||
                !creditsHydrated ||
                balance < 50 ||
                isProcessing ||
                (isI2V && !imageUrl)
              }
              onClick={handleGenerate}
            >
              {isProcessing ? "Generating..." : "Generate Video"}
            </Button>
            {creditsHydrated && balance < 50 && (
              <p className="mt-2 text-xs text-error text-center">
                Insufficient credits.{" "}
                <button
                  onClick={() => router.push("/credits")}
                  className="underline cursor-pointer"
                >
                  Buy more
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
                    No credits left
                  </span>
                </div>
                <p className="text-xs text-text-muted">
                  Upgrade to Pro or buy credit packs to continue generating.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  Recharge (Min. $10)
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
                  title="Create your video"
                  description="Enter a prompt and click generate to create stunning videos with AI."
                />
              </div>
            )}

            {(status === "GENERATING" || status === "REVEALING") && (
              <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                <LoadingSpinner
                  text="Generating video... This may take a few minutes."
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
                          toast.success("Download started");
                        } catch {
                          toast.error("Download failed");
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
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(videoUrl);
                        toast.success("URL copied to clipboard");
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
                      Copy URL
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
                      Generate New
                    </Button>
                  </div>
                )}
              </div>
            )}

            {status === "FAILED" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4 animate-fade-in">
                  <div className="rounded-xl border border-error/30 bg-error/5 p-8">
                    <p className="text-error font-medium">Generation failed</p>
                    <p className="text-sm text-text-muted mt-1">
                      {generationError || "Unknown error"}
                    </p>
                    {!generationError?.includes("content filter") && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-4"
                        onClick={handleGenerate}
                      >
                        Try Again
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
            <h2 className="text-lg font-semibold text-text">Variations</h2>
            <button
              onClick={() => setShowVariations(false)}
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
                Generated variations will appear here
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
