"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isTTSLanguage,
  type VoiceAssistantEvent,
} from "@creator-hub/shared-types";
import { useVoiceButton } from "@/components/voice-button";
import { useI18n } from "@/i18n/i18n-provider";
import { localizeError } from "@/i18n/errors";
import { useVoiceAssistantStore } from "@/store/voice-assistant.store";
import {
  SpeechPlayer,
  base64ToArrayBuffer,
  type SpeechSegment,
} from "@/lib/voice-assistant/speech-player";
import {
  TurnDetector,
  type TurnEndReason,
} from "@/lib/voice-assistant/turn-detector";
import type { OrbState } from "@/lib/voice-assistant/orb";

export type RobotinaState = OrbState;

/** Replies whose audio is kept for the replay button (most recent). */
const REPLAY_CACHE_SIZE = 30;
/** Pause between her last word and the mic opening again (hands-free). */
const RELISTEN_DELAY_MS = 350;
/** If the STT result never comes after a turn ends, give up. */
const RESULT_TIMEOUT_MS = 7000;

export interface UseRobotinaReturn {
  state: RobotinaState;
  /** What the user is saying right now (live STT). */
  liveTranscript: string;
  /** Localized error of the last turn, if any. */
  error: string | null;
  clearError: () => void;
  /** Voice input available (mic + WebSocket STT). */
  isVoiceSupported: boolean;
  /** Credits per minute of voice input (Admin → AI Models). */
  sttCreditsPerMinute: number;
  /**
   * The orb tap: idle → listen; listening → "I'm done" (send now);
   * thinking/speaking → interrupt her and listen (barge-in).
   */
  toggle: () => Promise<void>;
  startListening: () => Promise<void>;
  /** Ends the whole voice conversation (nothing more is sent). */
  stop: () => void;
  /** Typed message: she answers in text. */
  sendText: (text: string) => Promise<void>;
  /** Plays a reply of this visit again (no new charge). */
  replay: (messageId: string) => void;
  canReplay: (messageId: string) => boolean;
  /** Live audio level (0–1) of whoever is talking, for the orb. */
  getLevel: () => number;
}

export function useRobotina(): UseRobotinaReturn {
  const { locale, t } = useI18n();
  const sendMessage = useVoiceAssistantStore((s) => s.sendMessage);
  const handsFree = useVoiceAssistantStore((s) => s.handsFree);
  const loadPreferences = useVoiceAssistantStore((s) => s.loadPreferences);

  const [state, setStateValue] = useState<RobotinaState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setCacheVersion] = useState(0);

  const stateRef = useRef<RobotinaState>("idle");
  const setState = useCallback((next: RobotinaState) => {
    stateRef.current = next;
    setStateValue(next);
  }, []);

  const mountedRef = useRef(true);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const segmentsRef = useRef<SpeechSegment[]>([]);
  const cacheRef = useRef(new Map<string, SpeechSegment[]>());
  const committedRef = useRef("");
  /** A voice conversation is running: relisten after she speaks. */
  const loopRef = useRef(false);
  /** The next STT result must be dropped (conversation stopped). */
  const discardResultRef = useRef(false);
  /** The mic was closed and the transcript is on its way. */
  const awaitingResultRef = useRef(false);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relistenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handsFreeRef = useRef(handsFree);
  handsFreeRef.current = handsFree;
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => loadPreferences(), [loadPreferences]);

  const player = useCallback((): SpeechPlayer => {
    playerRef.current ??= new SpeechPlayer();
    return playerRef.current;
  }, []);

  const report = useCallback((err: unknown) => {
    if (!mountedRef.current) return;
    setError(localizeError(err, "voiceAssistant.errors.replyFailed"));
  }, []);

  const clearTimers = () => {
    if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    if (relistenTimerRef.current) clearTimeout(relistenTimerRef.current);
    resultTimerRef.current = null;
    relistenTimerRef.current = null;
  };

  // Handlers reached through a ref: the STT socket listeners keep the
  // callbacks of the render that started listening.
  const handlers = useRef({
    partial: (_text: string, _isFinal: boolean) => {},
    utteranceEnd: () => {},
    result: (_full: string) => {},
    sttError: (_message: string) => {},
  });

  const voice = useVoiceButton({
    language: locale,
    onPartialTranscript: (text, isFinal) =>
      handlers.current.partial(text, isFinal),
    onUtteranceEnd: () => handlers.current.utteranceEnd(),
    onResult: (full) => handlers.current.result(full),
    onError: (message) => handlers.current.sttError(message),
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const turnRef = useRef<TurnDetector | null>(null);
  const turn = () =>
    (turnRef.current ??= new TurnDetector((reason) =>
      handlersEndTurn.current(reason),
    ));
  const handlersEndTurn = useRef<(reason: TurnEndReason) => void>(() => {});

  // ── Sending ───────────────────────────────────────────────────────
  const send = useCallback(
    async (text: string, spoken: boolean) => {
      abortRef.current?.abort();
      const abort = new AbortController();
      abortRef.current = abort;
      const speech = player();
      segmentsRef.current = [];
      if (spoken) speech.begin();
      else speech.stop();
      setState("thinking");
      setError(null);

      const onEvent = (event: VoiceAssistantEvent) => {
        if (abort.signal.aborted) return;
        if (event.type === "audio") {
          const segment: SpeechSegment = {
            data: base64ToArrayBuffer(event.data),
            mimeType: event.mimeType,
            durationMs: event.durationMs,
          };
          segmentsRef.current.push(segment);
          speech.enqueue(segment);
        } else if (event.type === "done" && segmentsRef.current.length > 0) {
          const cache = cacheRef.current;
          cache.set(event.messageId, segmentsRef.current);
          while (cache.size > REPLAY_CACHE_SIZE) {
            cache.delete(cache.keys().next().value!);
          }
          setCacheVersion((v) => v + 1);
        }
      };

      try {
        const hint = localeRef.current;
        const done = await sendMessage(text, {
          spoken,
          languageHint: isTTSLanguage(hint) ? hint : undefined,
          signal: abort.signal,
          onEvent,
        });
        if (!done || abort.signal.aborted || !mountedRef.current) return;
        if (spoken) {
          // Ends (onEnd) after the last segment — at once if there was none.
          speech.finish();
        } else {
          setState("idle");
        }
      } catch (err) {
        if (abort.signal.aborted || !mountedRef.current) return;
        speech.stop();
        loopRef.current = false;
        setState("idle");
        report(err);
      }
    },
    [player, report, sendMessage, setState],
  );

  // ── Listening ─────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    clearTimers();
    if (!voiceRef.current.isSupported) {
      setError(t("voiceAssistant.errors.voiceUnsupported"));
      return;
    }
    abortRef.current?.abort(); // barge-in: she stops talking
    const speech = player();
    speech.stop();
    void speech.unlock(); // inside the tap: allows her voice later
    discardResultRef.current = false;
    committedRef.current = "";
    setLiveTranscript("");
    setError(null);
    loopRef.current = true;
    setState("listening");
    turn().start();
    await voiceRef.current.startListening();
  }, [player, setState, t]);

  /** "I'm done talking": close the mic, the transcript will be sent. */
  const finishTurn = useCallback(() => {
    turn().stop();
    setState("thinking");
    awaitingResultRef.current = true;
    voiceRef.current.stopListening();
    clearTimers();
    resultTimerRef.current = setTimeout(() => {
      // No STT result (mic never opened, socket lost…): back to idle.
      if (awaitingResultRef.current) {
        awaitingResultRef.current = false;
        loopRef.current = false;
        setState("idle");
      }
    }, RESULT_TIMEOUT_MS);
  }, [setState]);

  const stop = useCallback(() => {
    clearTimers();
    awaitingResultRef.current = false;
    loopRef.current = false;
    turn().stop();
    abortRef.current?.abort();
    abortRef.current = null;
    playerRef.current?.stop();
    if (stateRef.current === "listening") {
      discardResultRef.current = true;
      voiceRef.current.stopListening();
    }
    setLiveTranscript("");
    setState("idle");
  }, [setState]);

  const toggle = useCallback(async () => {
    switch (stateRef.current) {
      case "idle":
        await startListening();
        break;
      case "listening":
        finishTurn();
        break;
      default:
        // Thinking or speaking: interrupt her and listen.
        await startListening();
    }
  }, [finishTurn, startListening]);

  const sendText = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      if (stateRef.current === "listening") {
        discardResultRef.current = true;
        turn().stop();
        voiceRef.current.stopListening();
      }
      clearTimers();
      loopRef.current = false;
      void player().unlock();
      await send(text, false);
    },
    [player, send],
  );

  // Handlers (always the latest closures).
  handlers.current = {
    partial: (text, isFinal) => {
      if (stateRef.current !== "listening") return;
      turn().transcript(text, isFinal);
      if (isFinal) {
        committedRef.current = `${committedRef.current} ${text}`.trim();
        setLiveTranscript(committedRef.current);
      } else {
        setLiveTranscript(`${committedRef.current} ${text}`.trim());
      }
    },
    utteranceEnd: () => turn().utteranceEnd(),
    result: (full) => {
      clearTimers();
      awaitingResultRef.current = false;
      turn().stop();
      const text = (full || committedRef.current).trim();
      committedRef.current = "";
      setLiveTranscript("");
      if (!mountedRef.current || discardResultRef.current) {
        discardResultRef.current = false;
        return;
      }
      if (!text) {
        // Nothing was said: the conversation pauses.
        loopRef.current = false;
        setState("idle");
        return;
      }
      void send(text, true);
    },
    sttError: (message) => {
      clearTimers();
      awaitingResultRef.current = false;
      turn().stop();
      loopRef.current = false;
      setLiveTranscript("");
      setState("idle");
      if (message) report(new Error(message));
    },
  };
  handlersEndTurn.current = (reason) => {
    if (stateRef.current !== "listening") return;
    if (reason === "silence") loopRef.current = false;
    finishTurn();
  };

  // ── Her voice ─────────────────────────────────────────────────────
  useEffect(() => {
    const speech = player();
    const offStart = speech.onStart(() => {
      if (stateRef.current === "thinking") setState("speaking");
    });
    const offEnd = speech.onEnd(() => {
      if (!mountedRef.current) return;
      if (loopRef.current && handsFreeRef.current) {
        setState("listening");
        relistenTimerRef.current = setTimeout(() => {
          if (stateRef.current === "listening" && loopRef.current) {
            void startListening();
          }
        }, RELISTEN_DELAY_MS);
      } else {
        loopRef.current = false;
        setState("idle");
      }
    });
    return () => {
      offStart();
      offEnd();
    };
  }, [player, setState, startListening]);

  const replay = useCallback(
    (messageId: string) => {
      const segments = cacheRef.current.get(messageId);
      if (!segments?.length) return;
      stop();
      const speech = player();
      void speech.unlock();
      setState("thinking");
      speech.replay(segments);
    },
    [player, setState, stop],
  );

  const canReplay = useCallback(
    (messageId: string) => !!cacheRef.current.get(messageId)?.length,
    [],
  );

  const getLevel = useCallback(() => {
    const current = stateRef.current;
    if (current === "listening") return voiceRef.current.getLevel?.() ?? 0;
    if (current === "speaking") return playerRef.current?.level() ?? 0;
    return 0;
  }, []);

  // Leaving the page: stop everything (an open mic is billed).
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
      turnRef.current?.stop();
      abortRef.current?.abort();
      if (stateRef.current === "listening") {
        discardResultRef.current = true;
        voiceRef.current.stopListening();
      }
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, []);

  return {
    state,
    liveTranscript,
    error,
    clearError: () => setError(null),
    isVoiceSupported: voice.isSupported,
    sttCreditsPerMinute: voice.creditsPerMinute,
    toggle,
    startListening,
    stop,
    sendText,
    replay,
    canReplay,
    getLevel,
  };
}
