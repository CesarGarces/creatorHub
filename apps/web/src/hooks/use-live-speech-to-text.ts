"use client";

import { useCallback, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import type { Socket } from "socket.io-client";

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

export function useLiveSpeechToText(options: UseLiveSpeechToTextOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listenersAttached = useRef(false);

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

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (listenersAttached.current && socketRef.current) {
      socketRef.current.off("stt:partial");
      socketRef.current.off("stt:utterance_end");
      socketRef.current.off("stt:result");
      socketRef.current.off("stt:error");
      socketRef.current.off("stt:started");
      listenersAttached.current = false;
    }

    socketRef.current = null;
    setIsListening(false);
  }, []);

  const attachSocketListeners = useCallback(
    (socket: Socket) => {
      if (listenersAttached.current) return;
      listenersAttached.current = true;

      socket.on(
        "stt:partial",
        (data: { text: string; isFinal: boolean; timestamp: number }) => {
          console.log("[STT] stt:partial:", data.text, data.isFinal);
          options.onPartialTranscript(data.text, data.isFinal);
        },
      );

      socket.on("stt:utterance_end", () => {
        options.onUtteranceEnd();
      });

      socket.on(
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

      socket.on("stt:error", (data: { code: string; message: string }) => {
        pendingResultRef.current = false;
        options.onError(data.message);
        cleanup();
      });

      socket.on("stt:started", () => {});
    },
    [options, cleanup],
  );

  const startListening = useCallback(async () => {
    if (isListening) return;

    if (typeof AudioContext === "undefined") {
      setIsSupported(false);
      options.onError("AudioContext is not supported in this browser");
      return;
    }

    let socket: Socket;
    try {
      const rawSocket = getSocket();
      socket = await waitForConnection(rawSocket);
    } catch (err) {
      console.error("[STT] Connection failed:", err);
      options.onError("Could not connect to server");
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
            ? "Microphone permission denied"
            : error.name === "NotFoundError"
              ? "No microphone found"
              : error.message
          : "Failed to access microphone";
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

  return {
    startListening,
    stopListening,
    isListening,
    isSupported,
  };
}
