import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

type Handler = (payload?: unknown) => void;

const fakeSocket = vi.hoisted(() => {
  const listeners = new Map<string, Set<Handler>>();
  return {
    listeners,
    connected: true,
    emitted: [] as Array<[string, unknown]>,
    on(event: string, fn: Handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off(event: string, fn?: Handler) {
      if (fn) listeners.get(event)?.delete(fn);
      else listeners.delete(event);
    },
    emit(event: string, payload?: unknown) {
      this.emitted.push([event, payload]);
    },
    serverSends(event: string, payload?: unknown) {
      for (const fn of [...(listeners.get(event) ?? [])]) fn(payload);
    },
    count: (event: string) => listeners.get(event)?.size ?? 0,
    connect: () => undefined,
  };
});

vi.mock("@/lib/socket", () => ({ getSocket: () => fakeSocket }));

import {
  analyserLevel,
  useLiveSpeechToText,
} from "@/hooks/use-live-speech-to-text";

let level = 0;
class FakeAudioContext {
  sampleRate = 16000;
  destination = {};
  createMediaStreamSource() {
    return { connect: vi.fn(), disconnect: vi.fn() };
  }
  createScriptProcessor() {
    return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
  }
  createAnalyser() {
    return {
      fftSize: 512,
      getFloatTimeDomainData: (data: Float32Array) => data.fill(level),
    };
  }
  close() {
    return Promise.resolve();
  }
}

function options() {
  return {
    onPartialTranscript: vi.fn(),
    onUtteranceEnd: vi.fn(),
    onResult: vi.fn(),
    onError: vi.fn(),
  };
}

beforeEach(() => {
  fakeSocket.listeners.clear();
  fakeSocket.emitted = [];
  level = 0;
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: vi.fn() }],
      })),
    },
  });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLiveSpeechToText", () => {
  it("delivers the result and removes only its own listeners", async () => {
    const balanceRefresh = vi.fn();
    fakeSocket.on("stt:result", balanceRefresh); // useSocketEvents'
    const opts = options();
    const { result } = renderHook(() => useLiveSpeechToText(opts));

    await act(() => result.current.startListening());
    expect(fakeSocket.emitted[0]).toEqual(["stt:start", { language: "en" }]);
    expect(fakeSocket.count("stt:result")).toBe(2);

    act(() =>
      fakeSocket.serverSends("stt:partial", { text: "Hola", isFinal: true }),
    );
    expect(opts.onPartialTranscript).toHaveBeenCalledWith("Hola", true);

    act(() => result.current.stopListening());
    expect(fakeSocket.emitted.at(-1)![0]).toBe("stt:end");
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "Hola Robotina",
        durationMs: 1200,
        credits: 1,
      }),
    );

    expect(opts.onResult).toHaveBeenCalledWith("Hola Robotina", 1200, 1);
    expect(balanceRefresh).toHaveBeenCalledTimes(1);
    // The session is over: its listeners are gone, the app's stays.
    expect(fakeSocket.count("stt:result")).toBe(1);
    expect(fakeSocket.count("stt:partial")).toBe(0);
    fakeSocket.serverSends("stt:result", {});
    expect(balanceRefresh).toHaveBeenCalledTimes(2);
    expect(opts.onResult).toHaveBeenCalledTimes(1);
  });

  it("reports the live microphone level while listening", async () => {
    const { result } = renderHook(() => useLiveSpeechToText(options()));
    expect(result.current.getLevel()).toBe(0);
    await act(() => result.current.startListening());
    level = 0.1;
    expect(result.current.getLevel()).toBeCloseTo(0.4);
    level = 0.5;
    expect(result.current.getLevel()).toBe(1);
  });
});

describe("analyserLevel", () => {
  it("is 0 without an analyser and scales RMS to 0–1", () => {
    expect(analyserLevel(null)).toBe(0);
    const analyser = {
      fftSize: 4,
      getFloatTimeDomainData: (d: Float32Array) =>
        d.set([0.1, -0.1, 0.1, -0.1]),
    } as unknown as AnalyserNode;
    expect(analyserLevel(analyser)).toBeCloseTo(0.4);
  });
});
