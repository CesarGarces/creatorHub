"use client";

import { useChatStore } from "@/store/chat.store";

interface ChatSettingsProps {
  onClose: () => void;
}

const MODELS = [
  {
    id: "zai-org/GLM-5.2",
    name: "GLM-5.2",
    provider: "SiliconFlow",
    tier: "Free",
  },
  {
    id: "deepseek-ai/DeepSeek-V4-Flash",
    name: "DeepSeek V4 Flash",
    provider: "SiliconFlow",
    tier: "Free",
  },
  {
    id: "deepseek-ai/DeepSeek-V4-Pro",
    name: "DeepSeek V4 Pro",
    provider: "SiliconFlow",
    tier: "Pro",
  },
];

export function ChatSettings({ onClose }: ChatSettingsProps) {
  const { settings, updateSettings } = useChatStore();

  const handleModelChange = (modelId: string) => {
    updateSettings({ defaultModel: modelId as any });
  };

  const handleTemperatureChange = (value: number) => {
    updateSettings({ temperature: value });
  };

  const handleMaxTokensChange = (value: number) => {
    updateSettings({ maxTokens: value });
  };

  const handleReasoningChange = (value: number) => {
    updateSettings({ reasoning: value });
  };

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-border bg-surface-elevated shadow-xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-text">Chat Settings</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="rounded p-1 text-text-dim hover:text-text hover:bg-surface transition-colors"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4 p-4">
        {/* Model Selection */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-dim">
            Model
          </label>
          <select
            value={settings.defaultModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary/50 transition-colors"
          >
            {MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.tier})
              </option>
            ))}
          </select>
        </div>

        {/* Temperature */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-text-dim">
              Temperature
            </label>
            <span className="text-xs font-mono text-text">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.temperature}
            onChange={(e) =>
              handleTemperatureChange(parseFloat(e.target.value))
            }
            aria-label="Temperature"
            className="w-full accent-primary"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-text-dim">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-text-dim">
              Max Tokens
            </label>
            <span className="text-xs font-mono text-text">
              {settings.maxTokens.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min="256"
            max="16000"
            step="256"
            value={settings.maxTokens}
            onChange={(e) => handleMaxTokensChange(parseInt(e.target.value))}
            aria-label="Max Tokens"
            className="w-full accent-primary"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-text-dim">
            <span>256</span>
            <span>16,000</span>
          </div>
        </div>

        {/* Reasoning */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-text-dim">
              Reasoning
            </label>
            <span className="text-xs font-mono text-text">
              {settings.reasoning.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={settings.reasoning}
            onChange={(e) => handleReasoningChange(parseFloat(e.target.value))}
            aria-label="Reasoning"
            className="w-full accent-primary"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-text-dim">
            <span>Fast</span>
            <span>Deep</span>
          </div>
        </div>
      </div>
    </div>
  );
}
