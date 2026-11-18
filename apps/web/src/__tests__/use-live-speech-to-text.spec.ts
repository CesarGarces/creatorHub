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
    /** Last `stt:start`/`stt:end` payload sent by the hook. */
    last(event: string) {
      return [...this.emitted].reverse().find(([e]) => e === event)?.[1] as
        | { requestId?: string; language?: string }
        | undefined;
    },
    starts() {
      return this.emitted.filter(([e]) => e === "stt:start").length;
    },
  };
});

vi.mock("@/lib/socket", () => ({ getSocket: () => fakeSocket }));

import {
  analyserLevel,
  useLiveSpeechToText,
} from "@/hooks/use-live-speech-to-text";

let level = 0;
let trackStop = vi.fn();
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
  fakeSocket.connected = true;
  level = 0;
  trackStop = vi.fn();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: trackStop }],
      })),
    },
  });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
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
    const { requestId } = fakeSocket.last("stt:start")!;
    expect(fakeSocket.emitted[0]).toEqual([
      "stt:start",
      { language: "en", requestId: expect.any(String) },
    ]);
    expect(result.current.isListening).toBe(true);
    expect(fakeSocket.count("stt:result")).toBe(2);

    act(() =>
      fakeSocket.serverSends("stt:partial", { text: "Hola", isFinal: true }),
    );
    expect(opts.onPartialTranscript).toHaveBeenCalledWith("Hola", true);

    act(() => result.current.stopListening());
    expect(fakeSocket.emitted.at(-1)).toEqual(["stt:end", { requestId }]);
    // The user stopped: the microphone is released right away.
    expect(trackStop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "Hola Robotina",
        durationMs: 1200,
        credits: 1,
        requestId,
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

  it("says what the voice is for (Robotina: the Free minutes apply)", async () => {
    const { result } = renderHook(() =>
      useLiveSpeechToText({ ...options(), purpose: "voice-assistant" }),
    );
    await act(() => result.current.startListening());
    expect(fakeSocket.last("stt:start")).toMatchObject({
      purpose: "voice-assistant",
    });
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

describe("useLiveSpeechToText robustness", () => {
  async function startRecording() {
    const opts = options();
    const hook = renderHook(() => useLiveSpeechToText(opts));
    await act(() => hook.result.current.startListening());
    const requestId = fakeSocket.last("stt:start")!.requestId!;
    return { opts, hook, requestId };
  }

  it("ignores events of another session (stale requestId)", async () => {
    const { opts, hook, requestId } = await startRecording();
    act(() => {
      fakeSocket.serverSends("stt:partial", {
        text: "old",
        isFinal: true,
        requestId: "old-session",
      });
      fakeSocket.serverSends("stt:error", {
        code: "PROVIDER_CLOSED",
        message: "gone",
        requestId: "old-session",
      });
      fakeSocket.serverSends("stt:utterance_end", { requestId: "old" });
    });
    expect(opts.onPartialTranscript).not.toHaveBeenCalled();
    expect(opts.onUtteranceEnd).not.toHaveBeenCalled();
    expect(opts.onError).not.toHaveBeenCalled();
    expect(fakeSocket.starts()).toBe(1);
    expect(hook.result.current.isListening).toBe(true);

    act(() => hook.result.current.stopListening());
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "not mine",
        credits: 3,
        requestId: "old-session",
      }),
    );
    expect(opts.onResult).not.toHaveBeenCalled();
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "mine",
        credits: 1,
        requestId,
      }),
    );
    expect(opts.onResult).toHaveBeenCalledWith("mine", expect.any(Number), 1);
  });

  it("never closes the mic on interim results alone", async () => {
    vi.useFakeTimers();
    const { opts, hook, requestId } = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "I was saying",
        isFinal: false,
        requestId,
      }),
    );
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(hook.result.current.isListening).toBe(true);
    expect(trackStop).not.toHaveBeenCalled();
    expect(opts.onResult).not.toHaveBeenCalled();
  });

  it("reopens the session on the same mic when the provider drops, keeping the words", async () => {
    const { opts, hook, requestId } = await startRecording();
    act(() => {
      fakeSocket.serverSends("stt:partial", {
        text: "Hello",
        isFinal: true,
        requestId,
      });
      fakeSocket.serverSends("stt:partial", {
        text: "Robotina how",
        isFinal: false,
        requestId,
      });
      fakeSocket.serverSends("stt:error", {
        code: "PROVIDER_CLOSED",
        message: "The voice connection was interrupted",
        requestId,
      });
    });
    expect(opts.onError).not.toHaveBeenCalled();
    expect(hook.result.current.isListening).toBe(true);
    expect(trackStop).not.toHaveBeenCalled();
    expect(fakeSocket.starts()).toBe(2);
    // The phrase in progress is kept: committed for the UI too.
    expect(opts.onPartialTranscript).toHaveBeenLastCalledWith(
      "Robotina how",
      true,
    );
    const second = fakeSocket.last("stt:start")!.requestId!;
    expect(second).not.toBe(requestId);

    act(() => hook.result.current.stopListening());
    expect(fakeSocket.last("stt:end")).toEqual({ requestId: second });
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "are you",
        credits: 1,
        requestId: second,
      }),
    );
    expect(opts.onResult).toHaveBeenCalledWith(
      "Hello Robotina how are you",
      expect.any(Number),
      1,
    );
  });

  it("gives up after the restarts: keeps what was heard, else reports the error", async () => {
    const { opts, requestId } = await startRecording();
    let current = requestId;
    const drop = () =>
      act(() =>
        fakeSocket.serverSends("stt:error", {
          code: "PROVIDER_CLOSED",
          message: "The voice connection was interrupted",
          requestId: current,
        }),
      );
    drop();
    current = fakeSocket.last("stt:start")!.requestId!;
    drop();
    current = fakeSocket.last("stt:start")!.requestId!;
    expect(fakeSocket.starts()).toBe(3);
    drop(); // no restarts left, nothing heard
    expect(fakeSocket.starts()).toBe(3);
    expect(opts.onError).toHaveBeenCalledWith(
      expect.any(String),
      "PROVIDER_CLOSED",
    );
    expect(trackStop).toHaveBeenCalled();

    // Same thing with words heard: they are delivered, not lost.
    fakeSocket.emitted = [];
    const second = await startRecording();
    current = second.requestId;
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "keep me",
        isFinal: false,
        requestId: current,
      }),
    );
    drop();
    current = fakeSocket.last("stt:start")!.requestId!;
    drop();
    current = fakeSocket.last("stt:start")!.requestId!;
    drop();
    expect(second.opts.onError).not.toHaveBeenCalled();
    expect(second.opts.onResult).toHaveBeenCalledWith(
      "keep me",
      expect.any(Number),
      0,
    );
  });

  it("reports non-recoverable errors with their code", async () => {
    const { opts, hook, requestId } = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:error", {
        code: "INSUFFICIENT_CREDITS",
        message: "You need at least 1 credits to use voice recording",
        requestId,
      }),
    );
    expect(opts.onError).toHaveBeenCalledWith(
      expect.any(String),
      "INSUFFICIENT_CREDITS",
    );
    expect(fakeSocket.starts()).toBe(1);
    expect(hook.result.current.isListening).toBe(false);
    expect(trackStop).toHaveBeenCalled();
  });

  it("falls back to what was heard when the result is empty, lost or late", async () => {
    vi.useFakeTimers();
    // Empty server transcript.
    let rec = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "only interim",
        isFinal: false,
        requestId: rec.requestId,
      }),
    );
    act(() => rec.hook.result.current.stopListening());
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "",
        credits: 1,
        requestId: rec.requestId,
      }),
    );
    expect(rec.opts.onResult).toHaveBeenCalledWith(
      "only interim",
      expect.any(Number),
      1,
    );

    // Session lost on the server.
    rec = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "lost words",
        isFinal: true,
        requestId: rec.requestId,
      }),
    );
    act(() => rec.hook.result.current.stopListening());
    act(() =>
      fakeSocket.serverSends("stt:error", {
        code: "SESSION_LOST",
        message: "The voice session was lost",
        requestId: rec.requestId,
      }),
    );
    expect(rec.opts.onResult).toHaveBeenCalledWith(
      "lost words",
      expect.any(Number),
      0,
    );
    expect(rec.opts.onError).not.toHaveBeenCalled();

    // No answer at all.
    rec = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "late",
        isFinal: true,
        requestId: rec.requestId,
      }),
    );
    act(() => rec.hook.result.current.stopListening());
    await act(() => vi.advanceTimersByTimeAsync(5_900));
    expect(rec.opts.onResult).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(rec.opts.onResult).toHaveBeenCalledWith(
      "late",
      expect.any(Number),
      0,
    );
    // A result arriving afterwards is ignored.
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "late",
        credits: 1,
        requestId: rec.requestId,
      }),
    );
    expect(rec.opts.onResult).toHaveBeenCalledTimes(1);
  });

  it("delivers the result when the server ends it (credits ran out)", async () => {
    const { opts, hook, requestId } = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "lo que alcancé a decir",
        isFinal: true,
        requestId,
      }),
    );
    // A plain result while recording is not ours to take…
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "x",
        credits: 1,
        requestId,
      }),
    );
    expect(opts.onResult).not.toHaveBeenCalled();
    // …but the server ending the recording is.
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "lo que alcancé a decir",
        durationMs: 5000,
        credits: 10,
        endedBy: "credit-limit",
        requestId,
      }),
    );
    expect(opts.onResult).toHaveBeenCalledWith(
      "lo que alcancé a decir",
      5000,
      10,
    );
    expect(hook.result.current.isListening).toBe(false);
    expect(trackStop).toHaveBeenCalled();
  });

  it("a new start replaces a recording still waiting for its result", async () => {
    const opts = options();
    const { result } = renderHook(() => useLiveSpeechToText(opts));
    await act(() => result.current.startListening());
    const first = fakeSocket.last("stt:start")!.requestId!;
    act(() => result.current.stopListening());

    await act(() => result.current.startListening());
    const second = fakeSocket.last("stt:start")!.requestId!;
    expect(second).not.toBe(first);
    expect(result.current.isListening).toBe(true);
    // The first session's late result doesn't end the new recording.
    act(() =>
      fakeSocket.serverSends("stt:result", {
        fullTranscript: "first",
        credits: 1,
        requestId: first,
      }),
    );
    expect(opts.onResult).not.toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
    expect(fakeSocket.count("stt:partial")).toBe(1);
  });

  it("cancels cleanly when stopped before the microphone is ready", async () => {
    let grant: (stream: unknown) => void = () => undefined;
    (
      navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)));
    const opts = options();
    const { result } = renderHook(() => useLiveSpeechToText(opts));
    let starting: Promise<void> = Promise.resolve();
    act(() => {
      starting = result.current.startListening();
    });
    await act(async () => undefined);
    act(() => result.current.stopListening());
    expect(opts.onResult).toHaveBeenCalledWith("", expect.any(Number), 0);

    await act(async () => {
      grant({ getTracks: () => [{ stop: trackStop }] });
      await starting;
    });
    expect(trackStop).toHaveBeenCalled();
    expect(fakeSocket.starts()).toBe(0);
    expect(result.current.isListening).toBe(false);
  });

  it("survives a socket drop: resumes on reconnect, finishes if it was ending", async () => {
    const { opts, hook, requestId } = await startRecording();
    act(() =>
      fakeSocket.serverSends("stt:partial", {
        text: "before the drop",
        isFinal: true,
        requestId,
      }),
    );
    fakeSocket.connected = false;
    act(() => fakeSocket.serverSends("disconnect", "transport close"));
    expect(hook.result.current.isListening).toBe(true);
    fakeSocket.connected = true;
    act(() => fakeSocket.serverSends("connect"));
    expect(fakeSocket.starts()).toBe(2);
    expect(hook.result.current.isListening).toBe(true);

    act(() => hook.result.current.stopListening());
    fakeSocket.connected = false;
    act(() => fakeSocket.serverSends("disconnect", "transport close"));
    expect(opts.onResult).toHaveBeenCalledWith(
      "before the drop",
      expect.any(Number),
      0,
    );
    expect(opts.onError).not.toHaveBeenCalled();
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
