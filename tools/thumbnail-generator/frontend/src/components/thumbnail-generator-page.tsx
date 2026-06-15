"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { Button, Card, CardContent } from "@creator-hub/ui";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

const STYLE_PRESETS = [
  {
    label: "Bold & Colorful",
    prompt: "vibrant colors, bold text overlay, high contrast",
  },
  {
    label: "Minimalist",
    prompt: "clean design, minimal elements, soft gradients",
  },
  {
    label: "Reaction Face",
    prompt: "expressive face reaction, dramatic lighting",
  },
  { label: "Gaming", prompt: "gaming style, neon glow, dark background, epic" },
  {
    label: "Tutorial",
    prompt: "clean educational style, bright background, clear",
  },
  {
    label: "Cinematic",
    prompt: "cinematic lighting, film grain, dramatic shadows",
  },
];

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )ch_access_token=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const PROVIDERS = [
  { id: "gemini", label: "Gemini" },
  { id: "openai", label: "GPT Image" },
  { id: "flux", label: "Flux" },
  { id: "stability-ai", label: "Stability AI" },
];

export function ThumbnailGeneratorPage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [style, setStyle] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [result, setResult] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const fullPrompt = style ? `${prompt}, ${style}` : prompt;
      const token = getToken();
      const res = await fetch(`${API_URL}/images/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          negativePrompt,
          toolId: "thumbnail-generator",
          provider,
        }),
      });

      if (!res.ok) {
        let errorMessage = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          if (typeof body.message === "string") {
            errorMessage = body.message;
          } else if (Array.isArray(body.message) && body.message.length > 0) {
            errorMessage = body.message[0];
          } else if (body.error) {
            errorMessage = body.error;
          }
        } catch {
          try {
            const text = await res.text();
            if (text) errorMessage = text;
          } catch {}
        }
        throw new Error(errorMessage);
      }

      return res.json() as Promise<{
        success: boolean;
        data: { output: { url: string } };
      }>;
    },
    onSuccess: (data) => {
      if (data.success && data.data?.output?.url) {
        setResult(data.data.output.url);
        toast.success("Thumbnail generated successfully");
      } else {
        toast.error("Failed to generate thumbnail: no image URL returned");
      }
    },
    onError: (error: Error) => {
      toast.error(
        error.message || "Failed to generate thumbnail. Please try again.",
      );
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Toaster richColors position="top-right" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Thumbnail Generator
        </h1>
        <p className="text-gray-500">
          Create stunning YouTube thumbnails with AI in seconds
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STYLE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => setStyle(preset.prompt)}
            className={`rounded-lg border p-3 text-left text-sm transition-all ${
              style === preset.prompt
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Provider
        </label>
        <div className="flex gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`rounded-lg border px-4 py-2 text-sm transition-all ${
                provider === p.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Describe your thumbnail
            </label>
            <textarea
              value={prompt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setPrompt(e.target.value)
              }
              placeholder="e.g., A YouTube thumbnail for a video about AI art, with a futuristic robot painting on a canvas, neon colors..."
              rows={4}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              What to avoid (optional)
            </label>
            <input
              value={negativePrompt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNegativePrompt(e.target.value)
              }
              placeholder="blurry, low quality, text, watermark"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            isLoading={generateMutation.isPending}
            disabled={!prompt.trim()}
            className="w-full"
          >
            Generate Thumbnail (10 credits)
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <img
              src={result}
              alt="Generated thumbnail"
              className="w-full rounded-lg shadow-md"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const res = await fetch(result);
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
                Download
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(result);
                  toast.success("URL copied to clipboard");
                }}
              >
                Copy URL
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Generate New
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
