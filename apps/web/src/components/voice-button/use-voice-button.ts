"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { useLiveSpeechToText } from "@/hooks/use-live-speech-to-text";

const CREDITS_PER_MINUTE = 1;

interface UseVoiceButtonOptions {
  /** Language code for speech recognition (e.g., "en", "es") */
  language?: string;
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
  /** Called on error */
  onError?: (error: string) => void;
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
  creditsPerMinute: number;
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
    onPartialTranscript,
    onUtteranceEnd,
    onResult,
    onError,
    playSounds = true,
    externalIsListening,
    setExternalListening,
  } = options;

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
    (error: string) => {
      setInternalListening(false);
      setExternalListening?.(false);
      onError?.(error);
    },
    [onError, setExternalListening],
  );

  const {
    startListening: sttStart,
    stopListening: sttStop,
    isListening: sttIsListening,
    isSupported,
  } = useLiveSpeechToText({
    language,
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
    creditsPerMinute: CREDITS_PER_MINUTE,
  };
}
