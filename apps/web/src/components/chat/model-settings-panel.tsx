"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@creator-hub/ui";
import api from "@/lib/api";

interface ChatProvider {
  id: string;
  name: string;
  displayName: string;
  tier: "free" | "pro";
  costPerCredit: number;
  model: string;
  supportedTasks: string[];
}

export interface ModelSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  model: "deepseek-ai/DeepSeek-V4-Flash",
  temperature: 0.7,
  maxTokens: 300,
};

export function ModelSettingsPanel({
  settings,
  onUpdate,
  onClose,
}: {
  settings: ModelSettings;
  onUpdate: (data: Partial<ModelSettings>) => void;
  onClose: () => void;
}) {
  const [providers, setProviders] = useState<ChatProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModelOpen, setIsModelOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<ChatProvider[]>("/ai/providers")
      .then((list) => {
        if (Array.isArray(list)) {
          const chatProviders = list.filter((p) =>
            p.supportedTasks?.includes("text-generation"),
          );
          setProviders(chatProviders);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setIsModelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedProvider = providers.find((p) => p.model === settings.model);

  return (
    <div className="border-b border-border bg-surface-elevated/50">
      <div className="max-w-3xl mx-auto px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-text-dim"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
              Model Settings
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface transition-all cursor-pointer"
            aria-label="Close settings"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Controls Row */}
        <div className="flex items-start gap-5 flex-wrap">
          {/* Model Selector */}
          <div className="relative flex-1 min-w-[220px]" ref={modelDropdownRef}>
            <label
              htmlFor="model-select"
              className="block text-xs font-medium text-text-dim mb-1.5"
            >
              Model
            </label>
            {loading ? (
              <div className="h-10 rounded-lg bg-surface animate-pulse" />
            ) : (
              <>
                <button
                  id="model-select"
                  type="button"
                  onClick={() => setIsModelOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={isModelOpen}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all cursor-pointer min-h-[40px]",
                    isModelOpen
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-surface text-text hover:border-primary/40",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate text-xs">
                      {selectedProvider?.name || "Select model"}
                    </span>
                    {selectedProvider?.tier === "pro" && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                        PRO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {selectedProvider && (
                      <span className="text-[10px] text-text-muted tabular-nums">
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
                      className={cn(
                        "transition-transform duration-200 text-text-dim",
                        isModelOpen && "rotate-180",
                      )}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {isModelOpen && (
                  <div
                    className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-border bg-surface animate-fade-in"
                    role="listbox"
                    aria-label="Select model"
                  >
                    {providers.map((p) => {
                      const isSelected = settings.model === p.model;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onUpdate({ model: p.model });
                            setIsModelOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2.5 text-sm text-left transition-all cursor-pointer min-h-[44px]",
                            isSelected
                              ? "bg-primary/5 text-primary"
                              : "text-text hover:bg-surface-elevated",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium truncate text-xs">
                              {p.name}
                            </span>
                            {p.tier === "pro" && (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                                PRO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-[10px] text-text-muted tabular-nums">
                              {p.costPerCredit} cr
                            </span>
                            {isSelected && (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
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

          {/* Temperature */}
          <div className="min-w-[150px]">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="temp-slider"
                className="text-xs font-medium text-text-dim"
              >
                Temperature
              </label>
              <span className="text-xs font-mono text-text tabular-nums">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              id="temp-slider"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) =>
                onUpdate({ temperature: parseFloat(e.target.value) })
              }
              className="w-full accent-primary h-1 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-text-dim">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="min-w-[130px]">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="tokens-slider"
                className="text-xs font-medium text-text-dim"
              >
                Max Tokens
              </label>
              <span className="text-xs font-mono text-text tabular-nums">
                {settings.maxTokens.toLocaleString()}
              </span>
            </div>
            <input
              id="tokens-slider"
              type="range"
              min="100"
              max="1000"
              step="50"
              value={settings.maxTokens}
              onChange={(e) =>
                onUpdate({ maxTokens: parseInt(e.target.value) })
              }
              className="w-full accent-primary h-1 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
