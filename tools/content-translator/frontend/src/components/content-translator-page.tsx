"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast, Toaster } from "sonner";
import { Button } from "@creator-hub/ui";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

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
];

const PROVIDERS = [
  { id: "deepseek-v4", label: "DeepSeek V4 Flash (Free)" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
];

function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )ch_access_token=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function ContentTranslatorPage() {
  const [text, setText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [provider, setProvider] = useState("deepseek-v4");
  const [result, setResult] = useState<string | null>(null);

  const translateMutation = useMutation({
    mutationFn: async () => {
      const token = getToken();
      const res = await fetch(`${API_URL}/tools/content-translator/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          targetLanguage,
          provider,
        }),
      });

      if (!res.ok) {
        let errorMessage = `Request failed (${res.status})`;
        try {
          const body = await res.json();
          errorMessage = body.message || body.error || errorMessage;
        } catch {}
        throw new Error(errorMessage);
      }

      return res.json() as Promise<{
        success: boolean;
        data: { jobId: string };
      }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success("Translation started");
      } else {
        toast.error("Failed to start translation");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Translation failed");
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <Toaster richColors position="top-right" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Content Translator</h1>
        <p className="text-gray-500">
          Translate content across multiple languages with AI
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Target Language
        </label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setTargetLanguage(lang.code)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                targetLanguage === lang.code
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Model
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Text to translate
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter the text you want to translate..."
          rows={8}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <Button
        onClick={() => translateMutation.mutate()}
        isLoading={translateMutation.isPending}
        disabled={!text.trim()}
        className="w-full"
      >
        Translate (Starts job)
      </Button>

      {result && (
        <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </div>
  );
}
