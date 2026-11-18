"use client";

import { useCallback, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";
import { t } from "@/i18n/runtime";
import { localizeError } from "@/i18n/errors";

interface UseLiveSpeechToTextOptions {
  language?: string;
  onPartialTranscript: (text: string, isFinal: boolean) => void;
  onUtteranceEnd: () => void;
  onResult: (
    fullTranscript: string,
    durationMs: number,
    credits: number,
  ) => void;
  onError: (error: string) => void;
}

const TARGET_SAMPLE_RATE = 16000;

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

export function useLiveSpeechToText(options: UseLiveSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelBufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listenersAttached = useRef(false);
  /** This hook's socket handlers: only these are removed on cleanup. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io listener signature
  const handlersRef = useRef<Array<[string, (...args: any[]) => void]>>([]);

  const pendingResultRef = useRef(false);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (listenersAttached.current && socketRef.current) {
      // Other listeners of these events (the app-wide balance refresh in
      // useSocketEvents) must survive the end of a voice session.
      for (const [event, handler] of handlersRef.current) {
        socketRef.current.off(event, handler);
      }
      handlersRef.current = [];
      listenersAttached.current = false;
    }

    socketRef.current = null;
    setIsListening(false);
  }, []);

  const attachSocketListeners = useCallback(
    (socket: Socket) => {
      if (listenersAttached.current) return;
      listenersAttached.current = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io listener signature
      const on = (event: string, handler: (...args: any[]) => void) => {
        socket.on(event, handler);
        handlersRef.current.push([event, handler]);
      };

      on(
        "stt:partial",
        (data: { text: string; isFinal: boolean; timestamp: number }) => {
          console.log("[STT] stt:partial:", data.text, data.isFinal);
          options.onPartialTranscript(data.text, data.isFinal);
        },
      );

      on("stt:utterance_end", () => {
        options.onUtteranceEnd();
      });

      on(
        "stt:result",
        (data: {
          fullTranscript: string;
          durationMs: number;
          wordCount: number;
          credits: number;
        }) => {
          pendingResultRef.current = false;
          options.onResult(data.fullTranscript, data.durationMs, data.credits);
          cleanup();
        },
      );

      on("stt:error", (data: { code: string; message: string }) => {
        pendingResultRef.current = false;
        options.onError(localizeError(data.message));
        cleanup();
      });

      on("stt:started", () => {});
    },
    [options, cleanup],
  );

  const startListening = useCallback(async () => {
    if (isListening) return;

    if (typeof AudioContext === "undefined") {
      setIsSupported(false);
      options.onError(t("voice.errors.notSupported"));
      return;
    }

    let socket: Socket;
    try {
      const rawSocket = getSocket();
      socket = await waitForConnection(rawSocket);
    } catch (err) {
      console.error("[STT] Connection failed:", err);
      options.onError(t("voice.errors.connectionFailed"));
      return;
    }

    socketRef.current = socket;
    attachSocketListeners(socket);

    try {
      console.log("[STT] Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Side tap for the live input level (visuals only).
      if (typeof audioContext.createAnalyser === "function") {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;
        levelBufferRef.current = new Float32Array(analyser.fftSize);
      }

      const bufferSize = 4096;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      processorRef.current = processor;

      socket.emit("stt:start", {
        language: options.language || "en",
      });
      console.log("[STT] stt:start emitted, using linear16 PCM...");

      let chunkCount = 0;
      processor.onaudioprocess = (event) => {
        if (!socket.connected) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcm16 = downsampleBuffer(
          inputData,
          audioContext.sampleRate,
          TARGET_SAMPLE_RATE,
        );

        chunkCount++;
        if (chunkCount % 50 === 0) {
          console.log("[STT] PCM chunk:", pcm16.buffer.byteLength, "bytes");
        }

        socket.emit("stt:chunk", pcm16.buffer);
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      console.log("[STT] Audio pipeline started, isListening = true");
      setIsListening(true);
    } catch (error) {
      const message =
        error instanceof DOMException
          ? error.name === "NotAllowedError"
            ? t("voice.errors.permissionDenied")
            : error.name === "NotFoundError"
              ? t("voice.errors.noMicrophone")
              : error.message
          : t("voice.errors.micFailed");
      options.onError(message);
      cleanup();
    }
  }, [isListening, options, attachSocketListeners, cleanup]);

  const stopListening = useCallback(() => {
    if (!isListening) return;

    if (socketRef.current?.connected) {
      socketRef.current.emit("stt:end");
      pendingResultRef.current = true;

      setTimeout(() => {
        if (pendingResultRef.current) {
          pendingResultRef.current = false;
          cleanup();
        }
      }, 5000);
    } else {
      cleanup();
    }
  }, [isListening, cleanup]);

  /** Current microphone level (0–1); 0 when not listening. */
  const getLevel = useCallback(
    () =>
      analyserLevel(analyserRef.current, levelBufferRef.current ?? undefined),
    [],
  );

  return {
    startListening,
    stopListening,
    isListening,
    isSupported,
    getLevel,
  };
}
