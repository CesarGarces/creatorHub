"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useCreditsStore } from "@/store/credits.store";

// ─── Mode → TaskType mapping ───────────────────────────────────────────────
// A model appears in the dropdown only if its taskType matches one of the
// tool's modes (intersection logic).

const MODE_TO_TASKTYPE: Record<string, string> = {
  image: "image-generation",
  text: "text-generation",
  chat: "text-generation",
  video: "video-generation",
  translation: "text-generation",
};

export function mapModesToTaskTypes(modes: string[]): string[] {
  const taskTypes = new Set<string>();
  for (const mode of modes) {
    const taskType = MODE_TO_TASKTYPE[mode];
    if (taskType) taskTypes.add(taskType);
  }
  return Array.from(taskTypes);
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  providerSlug: string;
  modelId: string;
  displayName: string;
  taskType: string;
  tier: "free" | "pro";
  creditCost: number;
  isActive: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  description: string | null;
  tags: string[];
}

export interface ProviderSelectProps {
  /** Modes the current tool supports (e.g. ["image", "text"]) */
  toolModes: string[];
  /** Currently selected model ID */
  value: string;
  /** Called when user selects a model */
  onChange: (modelId: string, model: ModelOption) => void;
  /** Disable all interactions */
  disabled?: boolean;
  /** Custom label (default: "AI Model") */
  label?: string;
  /** Optional class on the root wrapper */
  className?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ProviderSelect({
  toolModes,
  value,
  onChange,
  disabled = false,
  label = "AI Model",
  className,
}: ProviderSelectProps) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { plan } = useCreditsStore();

  // Map tool modes → taskTypes for the API query
  const taskTypes = useMemo(() => mapModesToTaskTypes(toolModes), [toolModes]);
  const taskTypesQuery = taskTypes.join(",");

  // Fetch models filtered by taskType
  useEffect(() => {
    if (taskTypes.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api
      .get<ModelOption[]>("/ai/models", {
        params: { taskTypes: taskTypesQuery },
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setModels(list);

        // Auto-select first if current value not in list or empty
        const validIds = new Set(list.map((m) => m.modelId));
        const first = list[0];
        if (first && (!value || !validIds.has(value))) {
          onChange(first.modelId, first);
        }
      })
      .catch(() => {
        setModels([]);
      })
      .finally(() => setLoading(false));
  }, [taskTypesQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedModel = models.find((m) => m.modelId === value);

  const taskTypeLabel: Record<string, string> = {
    "image-generation": "Image",
    "text-generation": "Text",
    "video-generation": "Video",
  };

  return (
    <div className={`relative ${className ?? ""}`} ref={dropdownRef}>
      {loading ? (
        <div className="flex h-12 items-center gap-2 rounded-lg bg-surface-elevated px-3 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-text-dim" />
          <span className="text-sm text-text-dim">Loading models...</span>
        </div>
      ) : models.length === 0 ? (
        <p className="text-xs text-text-dim">
          No models available for this tool.
        </p>
      ) : (
        <>
          {/* Trigger */}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen((v) => !v)}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] ${
              isOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface-elevated text-text hover:border-primary/50 hover:bg-primary/5"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">
                {selectedModel?.displayName || "Select model"}
              </span>
              {selectedModel?.tier === "pro" && (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                  PRO
                </span>
              )}
              {selectedModel && (
                <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[9px] font-medium text-text-dim">
                  {taskTypeLabel[selectedModel.taskType] ??
                    selectedModel.taskType}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {selectedModel && (
                <span className="text-xs text-text-muted tabular-nums">
                  {selectedModel.creditCost} cr
                </span>
              )}
              <ChevronDown
                size={16}
                className={`transition-transform duration-200 text-text-dim ${isOpen ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div
              className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-border bg-surface-elevated shadow-xl animate-fade-in"
              role="listbox"
              aria-label={label}
            >
              {models.map((model) => {
                const isSelected = value === model.modelId;
                const isProDisabled = model.tier === "pro" && plan === "FREE";

                return (
                  <button
                    key={model.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={disabled || isProDisabled}
                    onClick={() => {
                      if (isProDisabled) return;
                      onChange(model.modelId, model);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-3 text-sm text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px] ${
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-surface text-text"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">
                        {model.displayName}
                      </span>
                      {model.tier === "pro" && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">
                          PRO
                        </span>
                      )}
                      {isProDisabled && (
                        <span className="text-[10px] text-text-dim whitespace-nowrap">
                          (upgrade)
                        </span>
                      )}
                      <span className="rounded bg-surface-elevated px-1.5 py-0.5 text-[9px] font-medium text-text-dim">
                        {taskTypeLabel[model.taskType] ?? model.taskType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-xs text-text-muted tabular-nums">
                        {model.creditCost} cr
                      </span>
                      {isSelected && (
                        <Check size={16} className="text-primary" />
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
  );
}
