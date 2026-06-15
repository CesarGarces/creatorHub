"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useToolsStore } from "@/store/tools.store";
import { useCreditsStore } from "@/store/credits.store";
import { useGenerationStore } from "@/store/generation.store";
import api from "@/lib/api";
import { Button, Badge, Skeleton, EmptyState } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";
import { LiquidEtherBackground } from "@/components/animations";
import { UpgradeModal } from "@/components/modals/upgrade-modal";

const stylePresets = [
  { id: "bold", label: "Bold & Colorful", emoji: "🎨" },
  { id: "minimal", label: "Minimalist", emoji: "✨" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "cinematic", label: "Cinematic", emoji: "🎬" },
  { id: "tutorial", label: "Tutorial", emoji: "📚" },
  { id: "reaction", label: "Reaction Face", emoji: "😲" },
];

const aspectRatios = [
  { id: "1:1", label: "1:1", width: 1024, height: 1024, iconClass: "w-8 h-8" },
  { id: "3:4", label: "3:4", width: 768, height: 1024, iconClass: "w-6 h-8" },
  { id: "4:3", label: "4:3", width: 1024, height: 768, iconClass: "w-8 h-6" },
  { id: "9:16", label: "9:16", width: 720, height: 1280, iconClass: "w-5 h-8" },
  { id: "16:9", label: "16:9", width: 1280, height: 720, iconClass: "w-8 h-5" },
];

const providers = [
  {
    id: "z-image-turbo",
    label: "Z-Image Turbo",
    cost: 1,
    tier: "free" as const,
  },
  { id: "siliconflow", label: "FLUX 2 Pro", cost: 1, tier: "free" as const },
  { id: "gemini", label: "Gemini", cost: 5, tier: "pro" as const },
  { id: "openai", label: "DALL-E 3", cost: 10, tier: "pro" as const },
  { id: "flux", label: "Flux", cost: 6, tier: "pro" as const },
  { id: "stability-ai", label: "Stability AI", cost: 8, tier: "pro" as const },
];

export default function ThumbnailGeneratorPage() {
  const params = useParams();
  const { tools, fetchTools } = useToolsStore();
  const { balance, freeCredits, plan, fetchBalance } = useCreditsStore();
  const {
    status,
    resultUrl: imageUrl,
    resultId: imageId,
    error: generationError,
    prompt,
    negativePrompt,
    style,
    aiProvider,
    width,
    height,
    setPrompt,
    setNegativePrompt,
    setStyle,
    setAiProvider,
    setDimensions,
    startGeneration,
    setRevealing,
    setReady,
    setFailed,
    reset,
  } = useGenerationStore();
  const [variations, setVariations] = useState<
    Array<{ url: string; imageId: string }>
  >([]);
  const lastCompletedRef = useRef<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showVariations, setShowVariations] = useState(false);

  useEffect(() => {
    fetchTools();
    fetchBalance();
    const searchParams = new URLSearchParams(window.location.search);
    const promptParam = searchParams.get("prompt");
    if (promptParam) setPrompt(promptParam);
  }, [fetchTools, fetchBalance, setPrompt]);

  useEffect(() => {
    if (balance === 0 && plan === "FREE") {
      setShowUpgradeModal(true);
    }
  }, [balance, plan]);

  useEffect(() => {
    if (
      status === "READY" &&
      imageUrl &&
      lastCompletedRef.current !== imageUrl
    ) {
      lastCompletedRef.current = imageUrl;
      setVariations((prev) => {
        const exists = prev.some((v) => v.url === imageUrl);
        if (exists) return prev;
        return [{ url: imageUrl, imageId: "" }, ...prev].slice(0, 4);
      });
    }
  }, [status, imageUrl]);

  const tool = tools.find((t) => t.id === params.id);
  const selectedProvider = providers.find((p) => p.id === aiProvider);
  const isProcessing = status === "GENERATING" || status === "REVEALING";

  const generateMutation = useMutation({
    mutationFn: async () => {
      return api.post<{ success: boolean; data: { jobId: string } }>(
        "/tools/thumbnail-generator/generate",
        { prompt, negativePrompt, style, provider: aiProvider, width, height },
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
    reset();
    generateMutation.reset();
    generateMutation.mutate();
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
            {selectedProvider && (
              <Badge variant="primary" size="sm">
                ⚡ {selectedProvider.cost} credits
              </Badge>
            )}
            {plan === "FREE" && (
              <Badge variant="free" size="sm">
                FREE PLAN
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

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">
              AI Provider
            </label>
            <div className="space-y-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => !isProcessing && setAiProvider(p.id)}
                  disabled={
                    isProcessing ||
                    (p.tier === "pro" && plan === "FREE" && freeCredits > 0)
                  }
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    aiProvider === p.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-elevated text-text-muted hover:border-primary/50 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.label}</span>
                    {p.tier === "free" ? (
                      <Badge variant="free" size="sm">
                        FREE
                      </Badge>
                    ) : (
                      <Badge variant="premium" size="sm">
                        PRO
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs">⚡ {p.cost} cr</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="glow"
              size="lg"
              className="w-full"
              isLoading={isProcessing}
              disabled={
                !prompt.trim() ||
                balance < (selectedProvider?.cost || 1) ||
                isProcessing
              }
              onClick={handleGenerate}
            >
              {isProcessing ? "Generating..." : "Generate Thumbnail"}
            </Button>
            {balance < (selectedProvider?.cost || 1) && (
              <p className="mt-2 text-xs text-error text-center">
                Insufficient credits.{" "}
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="underline"
                >
                  Buy more
                </button>
              </p>
            )}
          </div>

          {balance === 0 && plan === "FREE" && (
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
            className="relative z-10"
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

            {status === "GENERATING" && (
              <div className="absolute inset-0 flex flex-col justify-center space-y-4 animate-fade-in p-4 z-10 opacity-15">
                <Skeleton className="w-full h-full rounded-xl" />
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
                    <Button variant="ghost" size="sm" onClick={handleGenerate}>
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
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowVariations(false)}
          />
          <div className="relative w-80 bg-surface border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text">Variations</h3>
              <button
                onClick={() => setShowVariations(false)}
                className="rounded-lg p-1.5 text-text-muted hover:text-text hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
      )}

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}
