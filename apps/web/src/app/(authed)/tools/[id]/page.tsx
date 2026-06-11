"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useToolsStore } from "@/store/tools.store";
import { useCreditsStore } from "@/store/credits.store";
import api from "@/lib/api";
import { Button, Badge, Skeleton, EmptyState } from "@creator-hub/ui";
import { TopBar } from "@/components/layout/top-bar";

const stylePresets = [
  { id: "bold", label: "Bold & Colorful", emoji: "🎨" },
  { id: "minimal", label: "Minimalist", emoji: "✨" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "cinematic", label: "Cinematic", emoji: "🎬" },
  { id: "tutorial", label: "Tutorial", emoji: "📚" },
  { id: "reaction", label: "Reaction Face", emoji: "😲" },
];

const providers = [
  { id: "openai", label: "DALL-E 3", cost: 10 },
  { id: "flux", label: "Flux", cost: 6 },
  { id: "stability-ai", label: "Stability AI", cost: 8 },
  { id: "gemini", label: "Gemini", cost: 5 },
];

export default function ThumbnailGeneratorPage() {
  const params = useParams();
  const router = useRouter();
  const { tools, fetchTools } = useToolsStore();
  const { balance, fetchBalance } = useCreditsStore();
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [style, setStyle] = useState("bold");
  const [provider, setProvider] = useState("openai");
  const [generatedImage, setGeneratedImage] = useState<any>(null);
  const [variations, setVariations] = useState<any[]>([]);

  useEffect(() => {
    fetchTools();
    fetchBalance();
  }, [fetchTools, fetchBalance]);

  const tool = tools.find((t) => t.id === params.id);
  const selectedProvider = providers.find((p) => p.id === provider);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return api.post<any>("/tools/thumbnail-generator/generate", {
        prompt,
        negativePrompt,
        style,
        provider,
        width: 1280,
        height: 720,
      });
    },
    onSuccess: (data) => {
      setGeneratedImage(data);
      setVariations((prev) => [data, ...prev].slice(0, 4));
      fetchBalance();
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
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
          selectedProvider && (
            <Badge variant="primary" size="sm">
              ⚡ {selectedProvider.cost} credits
            </Badge>
          )
        }
      />
      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Left Panel - Controls */}
        <div className="w-80 border-r border-border bg-surface p-5 space-y-6 overflow-y-auto flex-shrink-0">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the thumbnail you want to create..."
              className="w-full h-32 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-2">Negative Prompt</label>
            <input
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Exclude: text, watermark, blurry..."
              className="w-full rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-sm text-text placeholder:text-text-dim outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">Style</label>
            <div className="grid grid-cols-2 gap-2">
              {stylePresets.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    style === s.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-elevated text-text-muted hover:border-border/80"
                  }`}
                >
                  <span>{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-3">AI Provider</label>
            <div className="space-y-2">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-sm transition-all ${
                    provider === p.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface-elevated text-text-muted hover:border-border/80"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
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
              isLoading={generateMutation.isPending}
              disabled={!prompt.trim() || balance < (selectedProvider?.cost || 10)}
              onClick={handleGenerate}
            >
              Generate Thumbnail
            </Button>
            {balance < (selectedProvider?.cost || 10) && (
              <p className="mt-2 text-xs text-error text-center">
                Insufficient credits.{" "}
                <a href="/credits" className="underline">Buy more</a>
              </p>
            )}
          </div>
        </div>

        {/* Center - Preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-bg">
          {generateMutation.isPending ? (
            <div className="w-full max-w-2xl space-y-4">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <div className="flex justify-center gap-2">
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ) : generatedImage ? (
            <div className="w-full max-w-2xl space-y-4 animate-fade-in">
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img
                  src={generatedImage.url}
                  alt={prompt}
                  className="w-full aspect-video object-cover"
                />
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="secondary" size="sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  Download
                </Button>
                <Button variant="secondary" size="sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Copy URL
                </Button>
                <Button variant="ghost" size="sm" onClick={handleGenerate}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                  Generate New
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon="🎨"
              title="Create your thumbnail"
              description="Enter a prompt and click generate to create stunning thumbnails with AI."
            />
          )}
        </div>

        {/* Right Panel - Variations */}
        <div className="w-56 border-l border-border bg-surface p-4 space-y-3 overflow-y-auto flex-shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-dim">Variations</h3>
          {variations.length > 0 ? (
            variations.map((v, i) => (
              <div
                key={i}
                className={`rounded-lg overflow-hidden border cursor-pointer transition-all ${
                  generatedImage?.url === v.url
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border hover:border-border/80"
                }`}
                onClick={() => setGeneratedImage(v)}
              >
                <img src={v.url} alt={`Variation ${i + 1}`} className="w-full aspect-video object-cover" />
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-text-dim">
              Generated variations will appear here
            </div>
          )}
        </div>
      </div>
    </>
  );
}
