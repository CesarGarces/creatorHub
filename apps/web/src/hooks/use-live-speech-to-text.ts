"use client";

import { useCallback, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { t } from "@/i18n/runtime";
import { localizeError } from "@/i18n/errors";

interface UseLiveSpeechToTextOptions {
  language?: string;
  /**
   * What the voice is for, sent in `stt:start`: "voice-assistant" makes the
   * server apply the Free plan's minutes with Robotina.
   */
  purpose?: string;
  onPartialTranscript: (text: string, isFinal: boolean) => void;
  onUtteranceEnd: () => void;
  onResult: (
    fullTranscript: string,
    durationMs: number,
    credits: number,
  ) => void;
  /** `code`: the server's `stt:error` code, or DISCONNECTED / MIC_ERROR… */
  onError: (error: string, code?: string) => void;
}

const TARGET_SAMPLE_RATE = 16000;
/** After `stt:end`, how long to wait for the result before using ours. */
const RESULT_TIMEOUT_MS = 6000;
/** Server sessions re-opened within one recording after a drop. */
const MAX_RESTARTS = 2;
/** Server errors after which a new session on the same mic may work. */
const RECOVERABLE = new Set([
  "PROVIDER_CLOSED",
  "STREAM_ERROR",
  "SESSION_LOST",
]);

function waitForConnection(socket: Socket, timeoutMs = 5000): Promise<Socket> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve(socket);
      return;
    }

    const timer = setTimeout(() => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      reject(new Error("Connection timeout"));
    }, timeoutMs);

    function onConnect() {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      resolve(socket);
    }

    function onError(err: Error) {
      clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
      reject(err);
    }

    socket.on("connect", onConnect);
    socket.on("connect_error", onError);

    if (!socket.connected) {
      socket.connect();
    }
  });
}

function downsampleBuffer(
  buffer: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
): Int16Array {
  if (inputSampleRate === outputSampleRate) {
    const int16 = new Int16Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]!));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Int16Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const index = Math.round(i * ratio);
    const s = Math.max(-1, Math.min(1, buffer[index]!));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  return result;
}

/**
 * Loudness (0–1) of the last audio frame in an analyser: RMS of the
 * waveform, scaled so normal speech reaches ~0.5–1. Used for visuals (the
 * Robotina orb's waves), never for recognition.
 */
export function analyserLevel(
  analyser: AnalyserNode | null,
  buffer?: Float32Array<ArrayBuffer>,
): number {
  if (!analyser) return 0;
  const data = buffer ?? new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
  const rms = Math.sqrt(sum / data.length);
  return Math.min(1, rms * 4);
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `stt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

interface Mic {
  stream: MediaStream;
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  analyser: AnalyserNode | null;
  levelBuffer: Float32Array<ArrayBuffer> | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io listener signature
type Listener = (...args: any[]) => void;

/**
 * One recording, as the user sees it (tap to start → stop/result). It may
 * use several server sessions if the connection drops mid-speech.
 */
interface Recording {
  socket: Socket;
  /** Current server session: events of any other one are ignored. */
  requestId: string;
  state: "starting" | "active" | "ending" | "done";
  mic: Mic | null;
  /** Text of earlier server sessions of this recording (after a drop). */
  carried: string;
  /** Current session: confirmed phrases and the phrase in progress. */
  finals: string[];
  interim: string;
  restarts: number;
  startedAt: number;
  listeners: Array<[string, Listener]>;
  resultTimer: ReturnType<typeof setTimeout> | null;
}

const joinText = (parts: string[]) =>
  parts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");

/** Everything heard so far, across the recording's sessions. */
const heardText = (r: Recording) =>
  joinText([r.carried, ...r.finals, r.interim]);

/** (A function: the state changes across awaits, TS can't narrow it.) */
const isDone = (r: Recording) => r.state === "done";

/** Payloads without a requestId come from older servers: accept them. */
const isFor = (r: Recording, payload: unknown) => {
  const id = (payload as { requestId?: unknown } | null)?.requestId;
  return id === undefined || id === r.requestId;
};

function stopMic(mic: Mic | null): void {
  if (!mic) return;
  mic.processor.onaudioprocess = null;
  mic.processor.disconnect();
  mic.source.disconnect();
  mic.context.close().catch(() => {});
  mic.stream.getTracks().forEach((track) => track.stop());
}

/**
 * Live speech-to-text over the app socket (`stt:*`, Deepgram on the API).
 *
 * Robust by design — the microphone only stops on the user's stop or a
 * definitive result:
 * - every server session has a `requestId`; late events of an earlier one
 *   (or of a previous recording) are ignored;
 * - stop ends the capture at once and waits for *that* session's result;
 *   an empty, lost or late result falls back to what was heard locally
 *   (final phrases + the phrase in progress);
 * - if the provider or the socket drops mid-speech, a new server session is
 *   opened on the same microphone (up to MAX_RESTARTS) and the words heard
 *   so far are kept;
 * - starting while a previous recording is still finishing replaces it
 *   instead of being ignored.
 * Every end is logged with its reason (`[STT] …`).
 */
export function useLiveSpeechToText(options: UseLiveSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recordingRef = useRef<Recording | null>(null);
  // Callbacks of the latest render (listeners outlive renders).
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /** Ends a recording for good; callbacks (if any) are the caller's job. */
  const teardown = useCallback((r: Recording, reason: string) => {
    if (r.state === "done") return;
    console.info(`[STT] recording ended: ${reason}`);
    r.state = "done";
    if (r.resultTimer) clearTimeout(r.resultTimer);
    stopMic(r.mic);
    r.mic = null;
    for (const [event, handler] of r.listeners) r.socket.off(event, handler);
    r.listeners = [];
    if (recordingRef.current === r) {
      recordingRef.current = null;
      setIsListening(false);
    }
  }, []);

  /** Delivers what was heard as the result (server text preferred). */
  const finishWithText = useCallback(
    (
      r: Recording,
      reason: string,
      serverText = "",
      credits = 0,
      serverDurationMs?: number,
    ) => {
      if (r.state === "done") return;
      // The server's transcript of the current session is the most
      // accurate; what we heard ourselves fills in when it's missing.
      const text = serverText.trim()
        ? joinText([r.carried, serverText])
        : heardText(r);
      const durationMs =
        r.restarts === 0 && typeof serverDurationMs === "number"
          ? serverDurationMs
          : Date.now() - r.startedAt;
      teardown(r, reason);
      optionsRef.current.onResult(text, durationMs, credits);
    },
    [teardown],
  );

  const fail = useCallback(
    (r: Recording, reason: string, message: string, code?: string) => {
      if (r.state === "done") return;
      // Words already heard are never thrown away.
      if (heardText(r)) {
        finishWithText(r, `${reason} (kept what was heard)`);
        return;
      }
      teardown(r, reason);
      optionsRef.current.onError(message, code);
    },
    [finishWithText, teardown],
  );

  /** Opens a new server session on the same mic (after a drop). */
  const restart = useCallback((r: Recording, why: string): boolean => {
    if (r.state !== "active" || r.restarts >= MAX_RESTARTS) return false;
    if (!r.socket.connected) return false;
    r.restarts += 1;
    // What was heard is kept (incl. the phrase in progress, now final for
    // the UI too); the new session's transcript only covers what comes next.
    const pending = r.interim.trim();
    r.carried = heardText(r);
    r.finals = [];
    r.interim = "";
    r.requestId = newRequestId();
    console.info(
      `[STT] ${why}: reopening the session (${r.restarts}/${MAX_RESTARTS})`,
    );
    r.socket.emit("stt:start", {
      language: optionsRef.current.language || "en",
      requestId: r.requestId,
      ...(optionsRef.current.purpose
        ? { purpose: optionsRef.current.purpose }
        : {}),
    });
    if (pending) optionsRef.current.onPartialTranscript(pending, true);
    return true;
  }, []);

  const endRecording = useCallback(
    (r: Recording) => {
      if (r.state === "starting") {
        // Nothing was recorded yet: cancel (the mic is released when ready).
        finishWithText(r, "stopped before the microphone was ready");
        return;
      }
      if (r.state !== "active") return;
      r.state = "ending";
      // The user asked to stop: the mic stops now.
      stopMic(r.mic);
      r.mic = null;
      setIsListening(false);
      if (!r.socket.connected) {
        finishWithText(r, "stopped while offline");
        return;
      }
      r.socket.emit("stt:end", { requestId: r.requestId });
      r.resultTimer = setTimeout(
        () => finishWithText(r, "no result from the server in time"),
        RESULT_TIMEOUT_MS,
      );
    },
    [finishWithText],
  );

  const attach = useCallback(
    (r: Recording) => {
      const on = (event: string, handler: Listener) => {
        r.socket.on(event, handler);
        r.listeners.push([event, handler]);
      };

      on(
        "stt:partial",
        (data: { text: string; isFinal: boolean; requestId?: string }) => {
          if (r.state === "done" || !isFor(r, data)) return;
          if (data.isFinal) {
            r.finals.push(data.text);
            r.interim = "";
          } else {
            r.interim = data.text;
          }
          optionsRef.current.onPartialTranscript(data.text, data.isFinal);
        },
      );

      on("stt:utterance_end", (data: { requestId?: string }) => {
        if (r.state === "done" || !isFor(r, data)) return;
        optionsRef.current.onUtteranceEnd();
      });

      on(
        "stt:result",
        (data: {
          fullTranscript: string;
          durationMs: number;
          credits: number;
          requestId?: string;
          /** The server ended it: the balance paid for no more seconds. */
          endedBy?: "credit-limit";
        }) => {
          if (r.state === "done" || !isFor(r, data)) return;
          // While recording, only a server-side end (credits) is a result.
          if (r.state !== "ending" && !data.endedBy) return;
          finishWithText(
            r,
            data.endedBy ? `server ended it (${data.endedBy})` : "final result",
            data.fullTranscript,
            data.credits,
            data.durationMs,
          );
        },
      );

      on(
        "stt:error",
        (data: { code?: string; message: string; requestId?: string }) => {
          if (r.state === "done" || !isFor(r, data)) return;
          const code = data.code ?? "UNKNOWN";
          if (r.state === "ending") {
            finishWithText(r, `server ended the session (${code})`);
            return;
          }
          if (RECOVERABLE.has(code) && restart(r, `server error ${code}`))
            return;
          fail(r, `server error ${code}`, localizeError(data.message), code);
        },
      );

      // Socket dropped: the server closed the session. Resume on reconnect.
      on("disconnect", () => {
        if (r.state === "done") return;
        console.info("[STT] socket disconnected during a recording");
        if (r.state === "ending") {
          finishWithText(r, "socket disconnected while finishing");
        }
      });
      on("connect", () => {
        if (r.state !== "active") return;
        if (!restart(r, "socket reconnected")) {
          fail(
            r,
            "socket reconnected, no restarts left",
            t("voice.errors.connectionFailed"),
            "DISCONNECTED",
          );
        }
      });
    },
    [fail, finishWithText, restart],
  );

  const startListening = useCallback(async () => {
    // A recording still finishing (or running) is replaced, never ignored.
    const previous = recordingRef.current;
    if (previous) {
      if (previous.state === "active") {
        previous.socket.emit("stt:end", { requestId: previous.requestId });
      }
      teardown(previous, "replaced by a new recording");
    }

    if (typeof AudioContext === "undefined") {
      setIsSupported(false);
      optionsRef.current.onError(t("voice.errors.notSupported"), "UNSUPPORTED");
      return;
    }

    const r: Recording = {
      socket: getSocket(),
      requestId: newRequestId(),
      state: "starting",
      mic: null,
      carried: "",
      finals: [],
      interim: "",
      restarts: 0,
      startedAt: Date.now(),
      listeners: [],
      resultTimer: null,
    };
    // Registered before any await, so a stop while connecting is not lost.
    recordingRef.current = r;

    try {
      await waitForConnection(r.socket);
    } catch (err) {
      console.error("[STT] Connection failed:", err);
      if (isDone(r)) return;
      teardown(r, "could not connect");
      optionsRef.current.onError(
        t("voice.errors.connectionFailed"),
        "DISCONNECTED",
      );
      return;
    }
    if (isDone(r)) return; // replaced while connecting
    const socket = r.socket;
    attach(r);

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (isDone(r)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      const source = context.createMediaStreamSource(stream);
      let analyser: AnalyserNode | null = null;
      let levelBuffer: Float32Array<ArrayBuffer> | null = null;
      // Side tap for the live input level (visuals only).
      if (typeof context.createAnalyser === "function") {
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        levelBuffer = new Float32Array(analyser.fftSize);
      }
      const processor = context.createScriptProcessor(4096, 1, 1);
      r.mic = { stream, context, source, processor, analyser, levelBuffer };

      socket.emit("stt:start", {
        language: optionsRef.current.language || "en",
        requestId: r.requestId,
        ...(optionsRef.current.purpose
          ? { purpose: optionsRef.current.purpose }
          : {}),
      });

      processor.onaudioprocess = (event) => {
        // While offline the audio is dropped; the session resumes on reconnect.
        if (r.state !== "active" || !socket.connected) return;
        const pcm16 = downsampleBuffer(
          event.inputBuffer.getChannelData(0),
          context.sampleRate,
          TARGET_SAMPLE_RATE,
        );
        socket.emit("stt:chunk", pcm16.buffer);
      };
      source.connect(processor);
      processor.connect(context.destination);

      r.state = "active";
      setIsListening(true);
      console.info("[STT] recording started");
    } catch (error) {
      if (!r.mic) stream?.getTracks().forEach((track) => track.stop());
      if (isDone(r)) return;
      const message =
        error instanceof DOMException
          ? error.name === "NotAllowedError"
            ? t("voice.errors.permissionDenied")
            : error.name === "NotFoundError"
              ? t("voice.errors.noMicrophone")
              : error.message
          : t("voice.errors.micFailed");
      teardown(r, "microphone unavailable");
      optionsRef.current.onError(message, "MIC_ERROR");
    }
  }, [attach, teardown]);

  const stopListening = useCallback(() => {
    const r = recordingRef.current;
    if (r) endRecording(r);
  }, [endRecording]);

  /** Current microphone level (0–1); 0 when not listening. */
  const getLevel = useCallback(() => {
    const mic = recordingRef.current?.mic;
    return mic ? analyserLevel(mic.analyser, mic.levelBuffer ?? undefined) : 0;
  }, []);

  return {
    startListening,
    stopListening,
    isListening,
    isSupported,
    getLevel,
  };
}
