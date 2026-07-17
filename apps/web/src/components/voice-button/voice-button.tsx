"use client";

import { MicrophoneIcon, StopIcon } from "./voice-button-icons";
import { cn } from "@creator-hub/ui";

const CREDITS_PER_MINUTE = 1;

interface VoiceButtonProps {
  /** Visual variant */
  variant?: "icon" | "icon-text";
  /** Recording state */
  isListening?: boolean;
  /** Whether browser supports voice input */
  isSupported?: boolean;
  /** Toggle recording */
  onToggle?: () => void;
  /** Disabled state */
  disabled?: boolean;
  /** Custom label when not listening */
  label?: string;
  /** Custom label when listening */
  listeningLabel?: string;
  /** Show credits badge when recording */
  showCredits?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function VoiceButton({
  variant = "icon-text",
  isListening = false,
  isSupported = true,
  onToggle,
  disabled = false,
  label = "Voice",
  listeningLabel = "Listening...",
  showCredits = true,
  className,
}: VoiceButtonProps) {
  if (!isSupported) return null;

  const Icon = isListening ? StopIcon : MicrophoneIcon;
  const displayLabel = isListening ? listeningLabel : label;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative flex items-center gap-2 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        isListening
          ? "border-red-500/50 bg-red-500/15 text-red-400"
          : "border-border bg-surface-elevated text-text-muted hover:text-text hover:border-primary/50 hover:bg-primary/5",
        // Size variants
        variant === "icon"
          ? "h-11 w-11 justify-center px-0"
          : "px-3 py-2.5 text-sm font-medium",
        className,
      )}
      title={isListening ? "Stop recording" : "Start voice input"}
    >
      <Icon size={16} />

      {variant === "icon-text" && (
        <span className="text-xs">{displayLabel}</span>
      )}

      {isListening && (
        <>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          {showCredits && variant === "icon-text" && (
            <span className="text-[10px] text-red-400/80 ml-0.5">
              +{CREDITS_PER_MINUTE} cr/min
            </span>
          )}
        </>
      )}
    </button>
  );
}
