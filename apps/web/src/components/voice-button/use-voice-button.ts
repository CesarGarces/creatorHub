"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useLiveSpeechToText } from "@/hooks/use-live-speech-to-text";
import { useSttCreditsPerSecond } from "./use-voice-pricing";

interface UseVoiceButtonOptions {
  /** Language code for speech recognition (e.g., "en", "es") */
  language?: string;
  /** What the voice is for ("voice-assistant": Robotina's ears). */
  purpose?: string;
  /** Called with partial transcript text */
  onPartialTranscript?: (text: string, isFinal: boolean) => void;
  /** Called when an utterance ends */
  onUtteranceEnd?: () => void;
  /** Called with final result */
  onResult?: (
    fullTranscript: string,
    durationMs: number,
    credits: number,
  ) => void;
  /** Called on error (`code`: the STT error code, e.g. PROVIDER_CLOSED). */
  onError?: (error: string, code?: string) => void;
  /** Whether to play sounds on start/stop (default: true) */
  playSounds?: boolean;
  /** Optional external isListening state to sync with */
  externalIsListening?: boolean;
  /** Optional external setListening function */
  setExternalListening?: (listening: boolean) => void;
}

interface UseVoiceButtonReturn {
  isListening: boolean;
  isSupported: boolean;
  toggleMic: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
  /** Credits per second of voice input (Admin → Voice). */
  creditsPerSecond: number;
  /** Live microphone level (0–1) while listening — for visuals. */
  getLevel: () => number;
}

function playSound(src: string) {
  const audio = new Audio(src);
  audio.play().catch(() => {});
}

export function useVoiceButton(
  options: UseVoiceButtonOptions = {},
): UseVoiceButtonReturn {
  const {
    language = "en",
    purpose,
    onPartialTranscript,
    onUtteranceEnd,
    onResult,
    onError,
    playSounds = true,
    externalIsListening,
    setExternalListening,
  } = options;

  const creditsPerSecond = useSttCreditsPerSecond();

  // Internal state that updates immediately on user action
  const [internalListening, setInternalListening] = useState(false);

  const handlePartialTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      onPartialTranscript?.(text, isFinal);
    },
    [onPartialTranscript],
  );

  const handleUtteranceEnd = useCallback(() => {
    onUtteranceEnd?.();
  }, [onUtteranceEnd]);

  const handleResult = useCallback(
    (fullTranscript: string, durationMs: number, credits: number) => {
      // STT finished — sync internal state from the hook
      setInternalListening(false);
      setExternalListening?.(false);
      onResult?.(fullTranscript, durationMs, credits);
    },
    [onResult, setExternalListening],
  );

  const handleError = useCallback(
    (error: string, code?: string) => {
      setInternalListening(false);
      setExternalListening?.(false);
      onError?.(error, code);
    },
    [onError, setExternalListening],
  );

  const {
    startListening: sttStart,
    stopListening: sttStop,
    isListening: sttIsListening,
    isSupported,
    getLevel,
  } = useLiveSpeechToText({
    language,
    purpose,
    onPartialTranscript: handlePartialTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onResult: handleResult,
    onError: handleError,
  });

  // Use external state if provided, otherwise use our own
  const isListening = externalIsListening ?? internalListening;

  const startListening = useCallback(async () => {
    if (playSounds) {
      playSound("/Voice_record_start.mp3");
    }
    setInternalListening(true);
    setExternalListening?.(true);
    await sttStart();
  }, [playSounds, setExternalListening, sttStart]);

  const stopListening = useCallback(() => {
    if (playSounds) {
      playSound("/Voice_record_end.mp3");
    }
    // Update state immediately — no waiting for STT cleanup
    setInternalListening(false);
    setExternalListening?.(false);
    sttStop();
  }, [playSounds, setExternalListening, sttStop]);

  const toggleMic = useCallback(async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    toggleMic,
    startListening,
    stopListening,
    creditsPerSecond,
    getLevel,
  };
}
