"use client";

import type { ReactNode } from "react";
import { ProviderSelect } from "@/components/provider-select";
import { useI18n } from "@/i18n/i18n-provider";
import type { ModelSettings } from "@/lib/model-settings";

export {
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
} from "@/lib/model-settings";

export function ModelSettingsPanel({
  settings,
  onUpdate,
  onClose,
  footer,
}: {
  settings: ModelSettings;
  onUpdate: (data: Partial<ModelSettings>) => void;
  onClose: () => void;
  /** Extra row under the controls (e.g. Robotina's fixed voice). */
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="border-b border-border bg-surface-elevated/50">
      <div className="max-w-3xl mx-auto px-4 py-4 sm:px-6">
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
              {t("chat.modelSettings")}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 pointer-coarse:h-10 pointer-coarse:w-10 items-center justify-center rounded-md text-text-dim hover:text-text hover:bg-surface transition-all cursor-pointer"
            aria-label={t("chat.closeSettings")}
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
          <div className="relative w-full flex-1 sm:min-w-[220px]">
            <label className="block text-xs font-medium text-text-dim mb-1.5">
              {t("chat.model")}
            </label>
            <ProviderSelect
              toolModes={["chat", "text"]}
              value={settings.model}
              onChange={(_id, model) => {
                onUpdate({ model: model.modelId });
              }}
              label=""
            />
          </div>

          {/* Temperature */}
          <div className="min-w-[130px] flex-1 sm:flex-none sm:min-w-[150px]">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="temp-slider"
                className="text-xs font-medium text-text-dim"
              >
                {t("chat.temperature")}
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
              <span>{t("chat.precise")}</span>
              <span>{t("chat.creative")}</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div className="min-w-[130px] flex-1 sm:flex-none">
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="tokens-slider"
                className="text-xs font-medium text-text-dim"
              >
                {t("chat.maxTokens")}
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
        {footer}
      </div>
    </div>
  );
}
