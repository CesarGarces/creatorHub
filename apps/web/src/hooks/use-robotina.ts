"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import {
  FREE_VOICE_LIMIT_CODE,
  isTTSLanguage,
  type VoiceAllowance,
  type VoiceAssistantEvent,
  type VoicePricing,
} from "@creator-hub/shared-types";
import { useVoiceButton } from "@/components/voice-button";
import { useVoicePricing } from "@/components/voice-button/use-voice-pricing";
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
import { actionActivityKey } from "@/lib/voice-assistant/status";
import type { TranslationKey } from "@/i18n/translate";

export type RobotinaState = OrbState;

/** Replies whose audio is kept for the replay button (most recent). */
const REPLAY_CACHE_SIZE = 30;
/** Pause between her last word and the mic opening again (hands-free). */
const RELISTEN_DELAY_MS = 350;
/** If the STT result never comes after a turn ends, use what was heard. */
const RESULT_TIMEOUT_MS = 8000;

export interface UseRobotinaReturn {
  state: RobotinaState;
  /** What the user is saying right now (live STT). */
  liveTranscript: string;
  /** Localized error of the last turn, if any. */
  error: string | null;
  /**
   * What she is doing right now while thinking (e.g. "Checking your
   * calendar…" during an action), to show instead of "Thinking…".
   */
  activity: TranslationKey | null;
  clearError: () => void;
  /** Voice input available (mic + WebSocket STT). */
  isVoiceSupported: boolean;
  /** Credits per second of voice input (Admin → Voice). */
  sttCreditsPerSecond: number;
  /** Credits per second of her speech (Admin → Voice). */
  ttsCreditsPerSecond: number;
  /** Who speaks each language (Admin → Voice). */
  voices: VoicePricing["tts"]["voices"];
  /** Free plan minutes with her (null: unknown or not limited). */
  allowance: VoiceAllowance | null;
  /** The Free plan's minutes are used up: show the upgrade invitation. */
  limitReached: boolean;
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
  // Optional: refreshes calendar widgets after she creates a session (no
  // provider in isolated renders).
  const queryClient = useContext(QueryClientContext);
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const handsFree = useVoiceAssistantStore((s) => s.handsFree);
  const pricing = useVoicePricing();
  const allowance = useVoiceAssistantStore((s) => s.allowance);
  const loadAllowance = useVoiceAssistantStore((s) => s.loadAllowance);
  const markAllowanceExhausted = useVoiceAssistantStore(
    (s) => s.markAllowanceExhausted,
  );
  const allowanceRef = useRef(allowance);
  allowanceRef.current = allowance;
  // Free plan minutes: only asked for when the admin set a limit.
  const hasFreeLimit = pricing.freeTier !== null;
  useEffect(() => {
    if (hasFreeLimit) void loadAllowance();
  }, [hasFreeLimit, loadAllowance]);
  const loadPreferences = useVoiceAssistantStore((s) => s.loadPreferences);

  const [state, setStateValue] = useState<RobotinaState>("idle");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<TranslationKey | null>(null);
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
  /** The phrase in progress (interim words, not final yet). */
  const interimRef = useRef("");
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
    sttError: (_message: string, _code?: string) => {},
  });

  const voice = useVoiceButton({
    language: locale,
    // The server applies the Free plan's minutes with Robotina.
    purpose: "voice-assistant",
    onPartialTranscript: (text, isFinal) =>
      handlers.current.partial(text, isFinal),
    onUtteranceEnd: () => handlers.current.utteranceEnd(),
    onResult: (full) => handlers.current.result(full),
    onError: (message, code) => handlers.current.sttError(message, code),
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
        if (event.type === "action" && event.status !== "running") {
          setActivity(null);
        }
        if (event.type === "audio") {
          const segment: SpeechSegment = {
            data: base64ToArrayBuffer(event.data),
            mimeType: event.mimeType,
            durationMs: event.durationMs,
          };
          segmentsRef.current.push(segment);
          speech.enqueue(segment);
        } else if (event.type === "action" && event.status === "running") {
          setActivity(actionActivityKey(event.name));
        } else if (
          event.type === "action" &&
          event.status === "done" &&
          (event.data?.kind === "calendar-event" ||
            event.data?.kind === "calendar-project")
        ) {
          // Created, moved or deleted: "Plans for today" and the planner
          // show it at once.
          void queryClientRef.current?.invalidateQueries({
            queryKey: ["content-planner"],
          });
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
        setActivity(null);
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
        // Free minutes used up: the upgrade invitation shows instead.
        if ((err as { code?: string })?.code !== FREE_VOICE_LIMIT_CODE) {
          report(err);
        }
      }
    },
    [player, report, sendMessage, setState],
  );

  // ── Listening ─────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    clearTimers();
    // Free minutes used up: nothing to listen for (the UI invites to upgrade).
    if (allowanceRef.current?.exhausted) {
      loopRef.current = false;
      setState("idle");
      return;
    }
    if (!voiceRef.current.isSupported) {
      setError(t("voiceAssistant.errors.voiceUnsupported"));
      return;
    }
    abortRef.current?.abort(); // barge-in: she stops talking
    const speech = player();
    speech.stop();
    void speech.unlock(); // inside the tap: allows her voice later
    discardResultRef.current = false;
    awaitingResultRef.current = false; // a pending turn is replaced
    committedRef.current = "";
    interimRef.current = "";
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
      // Safety net (the STT hook answers within ~6 s): use what was heard.
      if (awaitingResultRef.current) {
        console.info("[Robotina] no STT result in time");
        handlers.current.result("");
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
    setActivity(null);
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
      if (!text.trim() || allowanceRef.current?.exhausted) return;
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
        interimRef.current = "";
        setLiveTranscript(committedRef.current);
      } else {
        interimRef.current = text;
        setLiveTranscript(`${committedRef.current} ${text}`.trim());
      }
    },
    utteranceEnd: () => turn().utteranceEnd(),
    result: (full) => {
      // A result nobody waits for (late, after the safety net) is dropped.
      if (!awaitingResultRef.current && stateRef.current !== "listening") {
        discardResultRef.current = false;
        return;
      }
      clearTimers();
      awaitingResultRef.current = false;
      turn().stop();
      // The STT hook already falls back to what it heard; this covers an
      // empty result with words on screen (never drop what was said).
      const text = (
        full.trim() || `${committedRef.current} ${interimRef.current}`
      ).trim();
      committedRef.current = "";
      interimRef.current = "";
      setLiveTranscript("");
      if (!mountedRef.current || discardResultRef.current) {
        discardResultRef.current = false;
        return;
      }
      // The user's voice counted towards the Free plan's minutes.
      if (allowanceRef.current?.limited) void loadAllowance();
      if (!text) {
        // Nothing was said: the conversation pauses.
        loopRef.current = false;
        setState("idle");
        return;
      }
      void send(text, true);
    },
    sttError: (message, code) => {
      console.info(`[Robotina] voice input stopped: ${code ?? "error"}`);
      if (code === FREE_VOICE_LIMIT_CODE) {
        markAllowanceExhausted();
        message = ""; // the upgrade invitation says it
      }
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
    console.info(`[Robotina] turn ended: ${reason}`);
    if (reason === "silence") loopRef.current = false;
    finishTurn();
  };

  // ── Her voice ─────────────────────────────────────────────────────
  useEffect(() => {
    const speech = player();
    const offStart = speech.onStart(() => {
      if (stateRef.current === "thinking") setState("speaking");
    });
    // Her voice ran out mid-reply: she's working (an action, the next
    // sentence) — show "thinking", it isn't the user's turn yet.
    const offDrain = speech.onDrain(() => {
      if (stateRef.current === "speaking") setState("thinking");
    });
    const offEnd = speech.onEnd(() => {
      if (!mountedRef.current) return;
      setActivity(null);
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
      offDrain();
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
    activity: state === "thinking" ? activity : null,
    clearError: () => setError(null),
    isVoiceSupported: voice.isSupported,
    sttCreditsPerSecond: pricing.stt.creditsPerSecond,
    ttsCreditsPerSecond: pricing.tts.creditsPerSecond,
    voices: pricing.tts.voices,
    allowance,
    limitReached: !!allowance?.exhausted,
    toggle,
    startListening,
    stop,
    sendText,
    replay,
    canReplay,
    getLevel,
  };
}
