"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToolsStore } from "@/store/tools.store";
import { useCreditsStore } from "@/store/credits.store";
import { useGenerationStore } from "@/store/generation.store";
import api from "@/lib/api";
import { Button, Badge, EmptyState, LoadingSpinner } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { LiquidEtherBackground } from "@/components/animations";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { useToolQueryParams } from "@/hooks/use-tool-query-params";
import { ProviderSelect } from "@/components/provider-select";

const stylePresets = [
  { id: "bold", label: "Bold & Colorful", emoji: "🎨" },
  { id: "minimal", label: "Minimalist", emoji: "✨" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "cinematic", label: "Cinematic", emoji: "🎬" },
  { id: "tutorial", label: "Tutorial", emoji: "📚" },
  { id: "reaction", label: "Reaction Face", emoji: "😲" },
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

const aspectRatios = [
  { id: "1:1", label: "1:1", width: 1024, height: 1024, iconClass: "w-8 h-8" },
  { id: "3:4", label: "3:4", width: 768, height: 1024, iconClass: "w-6 h-8" },
  { id: "4:3", label: "4:3", width: 1024, height: 768, iconClass: "w-8 h-6" },
  { id: "9:16", label: "9:16", width: 720, height: 1280, iconClass: "w-5 h-8" },
  { id: "16:9", label: "16:9", width: 1280, height: 720, iconClass: "w-8 h-5" },
];

export default function ThumbnailGeneratorPage() {
  const params = useParams();
  const router = useRouter();
  const { tools, fetchTools } = useToolsStore();
  const {
    balance,
    plan,
    isLoading: creditsLoading,
    isHydrated: creditsHydrated,
    fetchBalance,
  } = useCreditsStore();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const {
    status,
    resultUrl: imageUrl,
    resultId: imageId,
    error: generationError,
    prompt,
    negativePrompt,
    style,
    aiProvider,
    providerSlug,
    width,
    height,
    sourceImageUrl,
    variations,
    setPrompt,
    setNegativePrompt,
    setStyle,
    setAiProvider,
    setProviderSlug,
    setDimensions,
    setSourceImageUrl,
    startGeneration,
    setRevealing,
    setReady,
    setFailed,
    addVariation,
    reset,
    resetAll,
  } = useGenerationStore();
  const lastCompletedRef = useRef<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showVariations, setShowVariations] = useState(false);

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
      imageUrl &&
      lastCompletedRef.current !== imageUrl
    ) {
      lastCompletedRef.current = imageUrl;
      addVariation(imageUrl, imageId || "");
    }
  }, [status, imageUrl, imageId, addVariation]);

  const _tool = tools.find((t) => t.id === params.id);
  const [selectedModelCost, setSelectedModelCost] = useState<number>(0);
  const isProcessing = status === "GENERATING" || status === "REVEALING";

  const generateMutation = useMutation({
    mutationFn: async (payload: {
      prompt: string;
      negativePrompt?: string;
      style?: string;
      provider?: string;
      width?: number;
      height?: number;
      aspectRatio?: string;
      imageUrl?: string;
    }) => {
      return api.post<{ success: boolean; data: { jobId: string } }>(
        "/tools/thumbnail-generator/generate",
        payload,
      );
    },
    onSuccess: (response) => {
      const jobId = response?.data?.jobId;
      if (!jobId) {
        toast.error("Generation failed: no job ID returned");
        return;
      }
      lastCompletedRef.current = null;
      startGeneration("thumbnail-generator", jobId);
    },
    onError: (error: any) => {
      const message =
        error?.message || "Failed to generate thumbnail. Please try again.";
      setFailed(message);
      toast.error(message);
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    const matchedRatio = aspectRatios.find(
      (ar) => ar.width === width && ar.height === height,
    );
    const payload: typeof generateMutation.variables = {
      prompt,
      negativePrompt,
      style,
      provider: aiProvider,
      width,
      height,
      aspectRatio: matchedRatio?.id || "16:9",
    };
    if (sourceImageUrl) {
      payload.imageUrl = sourceImageUrl;
    }
    reset();
    setSourceImageUrl(null);
    generateMutation.reset();
    generateMutation.mutate(payload);
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "Tools", href: "/tools" },
          { label: "Thumbnail Generator" },
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
            {selectedModelCost > 0 && (
              <Badge variant="primary" size="sm">
                ⚡ {selectedModelCost} credits
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
              placeholder="Describe the thumbnail you want to create..."
              disabled={isProcessing}
              className="w-full h-32 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">
              Negative Prompt
            </label>
            <input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Exclude: text, watermark, blurry..."
              disabled={isProcessing}
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">
              Aspect Ratio
            </label>
            <div
              className="flex gap-1.5"
              role="radiogroup"
              aria-label="Aspect ratio selection"
            >
              {aspectRatios.map((ar) => {
                const isSelected = width === ar.width && height === ar.height;
                return (
                  <button
                    key={ar.id}
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`${ar.label} aspect ratio`}
                    onClick={() =>
                      !isProcessing && setDimensions(ar.width, ar.height)
                    }
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
                        width:
                          ar.id === "1:1"
                            ? 20
                            : ar.id === "4:3" || ar.id === "16:9"
                              ? 24
                              : 14,
                        height:
                          ar.id === "1:1"
                            ? 20
                            : ar.id === "3:4" || ar.id === "9:16"
                              ? 24
                              : 14,
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

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">
              Style
            </label>
            <div className="grid grid-cols-2 gap-2">
              {stylePresets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => !isProcessing && setStyle(s.id)}
                  disabled={isProcessing}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    style === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-elevated text-text-muted hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <ProviderSelect
            toolModes={["image"]}
            value={aiProvider}
            onChange={(_modelId, model) => {
              setAiProvider(model.modelId);
              setProviderSlug(model.providerSlug);
              setSelectedModelCost(model.creditCost);
            }}
            disabled={isProcessing}
            label="AI Provider"
          />

          {providerSlug === "siliconflow" && (
            <div>
              <label className="block text-sm font-medium text-text-muted mb-3">
                Reference Image (optional)
              </label>
              {sourceImageUrl ? (
                <div className="relative group">
                  <img
                    src={sourceImageUrl}
                    alt="Reference"
                    className="w-full h-40 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => setSourceImageUrl(null)}
                    disabled={isProcessing}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-error/80 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith("image/")) {
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        setSourceImageUrl(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-2 h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/50 bg-surface-elevated/50 cursor-pointer transition-all"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-text-dim"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                  <span className="text-xs text-text-dim">
                    Drop an image or click to upload
                  </span>
                  <span className="text-[10px] text-text-dim/60">
                    For image-to-image generation
                  </span>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) =>
                      setSourceImageUrl(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
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
                balance < (selectedModelCost || 1) ||
                isProcessing
              }
              onClick={handleGenerate}
            >
              {isProcessing ? "Generating..." : "Generate Thumbnail"}
            </Button>
            {creditsHydrated && balance < (selectedModelCost || 1) && (
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
              aspectRatio: `${width} / ${height}`,
              maxWidth: "100%",
              maxHeight: "100%",
              width: height > width ? "auto" : "100%",
              height: height > width ? "100%" : "auto",
            }}
          >
            <LiquidEtherBackground />

            {status === "IDLE" && !imageUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <EmptyState
                  icon="🎨"
                  title="Create your thumbnail"
                  description="Enter a prompt and click generate to create stunning thumbnails with AI."
                />
              </div>
            )}

            {/* Generating indicator */}
            {(status === "GENERATING" || status === "REVEALING") && (
              <div className="absolute inset-0 flex items-center justify-center z-10 animate-fade-in">
                <LoadingSpinner
                  text="Generating thumbnail..."
                  colors={["#c084fc", "#f472b6", "#38bdf8"]}
                />
              </div>
            )}

            {(status === "REVEALING" || status === "READY") && imageUrl && (
              <div className="absolute inset-0 flex flex-col justify-center space-y-4 animate-fade-in">
                <div
                  className={`relative rounded-xl overflow-hidden border border-border transition-opacity duration-700 ${
                    status === "READY" ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <img
                    src={imageUrl}
                    alt={prompt}
                    className="w-full h-full object-contain"
                  />
                </div>
                {status === "READY" && (
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          const res = await fetch(imageUrl);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "thumbnail.png";
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
                        navigator.clipboard.writeText(imageUrl);
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
                    imageUrl === v.url
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-border/80"
                  }`}
                  style={{
                    aspectRatio: `${width} / ${height}`,
                  }}
                  onClick={() => {
                    setRevealing(v.url, v.imageId);
                    setReady();
                    setShowVariations(false);
                  }}
                >
                  <img
                    src={v.url}
                    alt={`Variation ${i + 1}`}
                    className="w-full h-full object-contain"
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
