import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import type { STTStream, STTStreamParams } from "@creator-hub/shared-types";

/** Fake `ws` WebSocket: records sends and lets tests drive server events. */
const ws = vi.hoisted(() => ({
  sockets: [] as Array<{
    url: string;
    headers: Record<string, string>;
    readyState: number;
    sent: Buffer[];
    send: (data: Buffer | string) => void;
    close: ReturnType<typeof vi.fn>;
    holdCloseStream: boolean;
    emit: (event: string, ...args: unknown[]) => boolean;
  }>,
}));

vi.mock("ws", async () => {
  const { EventEmitter } = await import("events");
  class FakeWebSocket extends EventEmitter {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = 1;
    sent: Buffer[] = [];
    headers: Record<string, string>;
    close = vi.fn((_code?: number, _reason?: string) => {
      this.readyState = 3;
      this.emit("close");
    });
    constructor(
      public url: string,
      options: { headers: Record<string, string> },
    ) {
      super();
      this.headers = options.headers;
      ws.sockets.push(this as never);
    }
    /** Like Deepgram: "hold" to delay the close that follows CloseStream. */
    holdCloseStream = false;
    send(data: Buffer | string) {
      this.sent.push(data as Buffer);
      if (
        typeof data === "string" &&
        data.includes('"CloseStream"') &&
        !this.holdCloseStream
      ) {
        // Deepgram flushes its last results, then closes.
        setTimeout(() => this.close(1000, ""), 0);
      }
    }
  }
  return { default: FakeWebSocket };
});

import { DeepgramProvider } from "../providers/deepgram.provider";
import { MockSTTProvider } from "../providers/mock-stt.provider";
import { STTProviderRegistry } from "../providers/stt-provider.registry";
import { STTProviderFactory } from "../providers/stt-provider.factory";
import { STTSessionManager } from "../stt-session.manager";
import { STTEngineService } from "../stt-engine.service";

function params(overrides: Partial<STTStreamParams> = {}): STTStreamParams {
  return {
    language: "es",
    onPartialTranscript: vi.fn(),
    onUtteranceEnd: vi.fn(),
    onError: vi.fn(),
    onUnexpectedClose: vi.fn(),
    ...overrides,
  };
}

function fakeClient(id = "socket-1") {
  return { id, emit: vi.fn() };
}

const savedEnv = {
  key: process.env.DEEPGRAM_API_KEY,
  env: process.env.NODE_ENV,
};

beforeEach(() => {
  ws.sockets.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const level of ["log", "warn", "error", "debug"] as const) {
    vi.spyOn(Logger.prototype, level).mockImplementation(() => {});
  }
});
afterEach(() => {
  process.env.DEEPGRAM_API_KEY = savedEnv.key;
  process.env.NODE_ENV = savedEnv.env;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("DeepgramProvider", () => {
  beforeEach(() => {
    process.env.DEEPGRAM_API_KEY = "dg-test-key";
  });

  it("is only configured when DEEPGRAM_API_KEY is set", () => {
    expect(new DeepgramProvider().validateConfig()).toBe(true);
    delete process.env.DEEPGRAM_API_KEY;
    expect(new DeepgramProvider().validateConfig()).toBe(false);
    expect(() => new DeepgramProvider().createStream(params())).toThrow(
      "API key not configured for STT provider: deepgram",
    );
  });

  it("opens a linear16 16kHz Nova-3 stream authenticated with the API key", () => {
    new DeepgramProvider().createStream(
      params({ interimResults: false, endpointing: 500 }),
    );

    const [socket] = ws.sockets;
    const url = new URL(socket!.url);
    expect(url.origin + url.pathname).toBe("wss://api.deepgram.com/v1/listen");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      encoding: "linear16",
      sample_rate: "16000",
      channels: "1",
      model: "nova-3",
      language: "multi",
      interim_results: "false",
      endpointing: "500",
      utterance_end_ms: "3000",
    });
    expect(socket!.headers.Authorization).toBe("Token dg-test-key");
  });

  it("uses the model set in Admin → Voice (one language unless multilingual)", () => {
    new DeepgramProvider().createStream(
      params({ model: "nova-2", language: "es" }),
    );
    new DeepgramProvider().createStream(
      params({ model: "nova-3", language: "es" }),
    );
    const query = (i: number) =>
      Object.fromEntries(new URL(ws.sockets[i]!.url).searchParams);
    expect(query(0)).toMatchObject({ model: "nova-2", language: "es" });
    expect(query(1)).toMatchObject({ model: "nova-3", language: "multi" });
  });

  it("forwards interim and final transcripts, accumulating only finals", async () => {
    const p = params();
    const stream = new DeepgramProvider().createStream(p);
    const socket = ws.sockets[0]!;
    const results = (transcript: string, is_final: boolean) =>
      socket.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "Results",
            is_final,
            channel: { alternatives: [{ transcript }] },
          }),
        ),
      );

    results("hola", false);
    results("hola a todos", true);
    results("", true); // empty transcripts are ignored
    results("bienvenidos", true);

    expect(p.onPartialTranscript).toHaveBeenCalledWith("hola", false);
    expect(p.onPartialTranscript).toHaveBeenCalledWith("hola a todos", true);
    expect(p.onPartialTranscript).toHaveBeenCalledTimes(3);

    const result = await stream.end();
    expect(result).toMatchObject({
      fullTranscript: "hola a todos bienvenidos",
      language: "es",
      wordCount: 4,
    });
    // Graceful end: Deepgram is asked to flush, not hung up on.
    expect(socket.sent.at(-1)).toBe('{"type":"CloseStream"}');
  });

  it("keeps the words Deepgram sends after CloseStream", async () => {
    const p = params();
    const stream = new DeepgramProvider().createStream(p);
    const socket = ws.sockets[0]!;
    socket.holdCloseStream = true;
    const result = (text: string, isFinal: boolean) =>
      socket.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "Results",
            is_final: isFinal,
            channel: { alternatives: [{ transcript: text }] },
          }),
        ),
      );
    result("tengo algún", false);

    const ending = stream.end();
    result("tengo algún plan mañana", true); // flushed by CloseStream
    socket.close(1000, "");

    expect((await ending).fullTranscript).toBe("tengo algún plan mañana");
  });

  it("keeps interim words that were never finalized", async () => {
    const p = params();
    const stream = new DeepgramProvider().createStream(p);
    const socket = ws.sockets[0]!;
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "Results",
          is_final: true,
          channel: { alternatives: [{ transcript: "hola" }] },
        }),
      ),
    );
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "Results",
          is_final: false,
          channel: { alternatives: [{ transcript: "qué planes tengo" }] },
        }),
      ),
    );

    expect((await stream.end()).fullTranscript).toBe("hola qué planes tengo");
  });

  it("closes anyway if Deepgram doesn't answer CloseStream", async () => {
    vi.useFakeTimers();
    try {
      const stream = new DeepgramProvider().createStream(params());
      const socket = ws.sockets[0]!;
      socket.holdCloseStream = true;
      const ending = stream.end();
      await vi.advanceTimersByTimeAsync(3000);
      // The wait for Deepgram is not part of the (billed) duration.
      await expect(ending).resolves.toMatchObject({
        fullTranscript: "",
        durationMs: 0,
      });
      expect(socket.close).toHaveBeenCalledWith(1000, "stream ended");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the stream alive during pauses (KeepAlive without audio)", () => {
    vi.useFakeTimers();
    try {
      const stream = new DeepgramProvider().createStream(params());
      const socket = ws.sockets[0]!;
      vi.advanceTimersByTime(5000);
      expect(socket.sent).toContain('{"type":"KeepAlive"}');

      socket.sent.length = 0;
      vi.advanceTimersByTime(4000);
      stream.writeAudioChunk(Buffer.from([1])); // speaking again
      vi.advanceTimersByTime(1000);
      expect(socket.sent).not.toContain('{"type":"KeepAlive"}');
      stream.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports a close it didn't ask for, and only that one", async () => {
    const unexpected = params();
    new DeepgramProvider().createStream(unexpected);
    ws.sockets[0]!.emit("close", 1011, Buffer.from("NET-0001"));
    expect(unexpected.onUnexpectedClose).toHaveBeenCalledWith({
      code: 1011,
      reason: "NET-0001",
    });

    const requested = params();
    const stream = new DeepgramProvider().createStream(requested);
    await stream.end();
    stream.close();
    expect(requested.onUnexpectedClose).not.toHaveBeenCalled();
  });

  it("reports utterance ends and provider errors, ignoring malformed frames", () => {
    const p = params();
    new DeepgramProvider().createStream(p);
    const socket = ws.sockets[0]!;

    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: "UtteranceEnd" })),
    );
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: "Error", message: "bad audio" })),
    );
    socket.emit("message", Buffer.from("not json"));

    expect(p.onUtteranceEnd).toHaveBeenCalledTimes(1);
    expect(p.onError).toHaveBeenCalledWith(
      new Error("Deepgram error: bad audio"),
    );
  });

  it("only sends audio while the socket is open", () => {
    const stream = new DeepgramProvider().createStream(params());
    const socket = ws.sockets[0]!;

    stream.writeAudioChunk(new Uint8Array([1, 2]).buffer);
    socket.readyState = 0; // CONNECTING
    stream.writeAudioChunk(Buffer.from([3]));
    socket.readyState = 1;
    stream.close();
    stream.writeAudioChunk(Buffer.from([4]));

    expect(socket.sent).toEqual([Buffer.from([1, 2])]);
  });

  it("reports socket errors and stops accepting audio", () => {
    const p = params();
    const stream = new DeepgramProvider().createStream(p);
    const socket = ws.sockets[0]!;

    socket.emit("error", new Error("ECONNRESET"));
    stream.writeAudioChunk(Buffer.from([1]));

    expect(p.onError).toHaveBeenCalledWith(new Error("ECONNRESET"));
    expect(socket.sent).toHaveLength(0);
  });

  it("resolves end() immediately when already closed", async () => {
    const stream = new DeepgramProvider().createStream(
      params({ language: undefined }),
    );
    ws.sockets[0]!.emit("close");

    await expect(stream.end()).resolves.toMatchObject({
      fullTranscript: "",
      language: "en",
      wordCount: 0,
    });
  });
});

describe("MockSTTProvider", () => {
  it("needs no configuration", () => {
    expect(new MockSTTProvider().validateConfig()).toBe(true);
  });

  it("emits growing partial transcripts and a final result", async () => {
    vi.useFakeTimers();
    const p = params({ language: "en" });
    const stream = new MockSTTProvider().createStream(p);

    stream.writeAudioChunk(Buffer.from([0]));
    vi.advanceTimersByTime(10_000);
    stream.writeAudioChunk(Buffer.from([0]));

    expect(p.onPartialTranscript).toHaveBeenNthCalledWith(1, "Hello", false);
    expect(p.onPartialTranscript).toHaveBeenLastCalledWith(
      "Hello this is a mock transcription stream",
      true,
    );
    expect(await stream.end()).toMatchObject({
      fullTranscript: "Hello this is a mock transcription stream",
      wordCount: 7,
    });
  });

  it("returns a placeholder transcript when no final text arrived", async () => {
    const stream = new MockSTTProvider().createStream(params());
    expect((await stream.end()).fullTranscript).toBe(
      "Mock transcription result",
    );
  });
});

describe("STTProviderRegistry", () => {
  it("registers providers and picks the first configured one", () => {
    const registry = new STTProviderRegistry();
    delete process.env.DEEPGRAM_API_KEY;
    registry.register(new DeepgramProvider());
    registry.register(new MockSTTProvider());

    expect(registry.isRegistered("deepgram")).toBe(true);
    expect(registry.getAvailableProvider()?.name).toBe("mock");
    expect(registry.getAllProviders()).toHaveLength(2);
    expect(() => registry.getProvider("whisper" as never)).toThrow(
      "STT provider not found: whisper",
    );
  });

  it("returns undefined when no provider is configured", () => {
    delete process.env.DEEPGRAM_API_KEY;
    const registry = new STTProviderRegistry();
    registry.register(new DeepgramProvider());
    expect(registry.getAvailableProvider()).toBeUndefined();
  });
});

describe("STTProviderFactory", () => {
  it("registers Deepgram when its key is configured", () => {
    process.env.DEEPGRAM_API_KEY = "k";
    process.env.NODE_ENV = "production";
    const registry = new STTProviderRegistry();

    new STTProviderFactory(registry).onModuleInit();

    expect(registry.getAllProviders().map((p) => p.name)).toEqual(["deepgram"]);
  });

  it("adds the mock provider in development and test", () => {
    process.env.DEEPGRAM_API_KEY = "k";
    process.env.NODE_ENV = "development";
    const registry = new STTProviderRegistry();

    new STTProviderFactory(registry).onModuleInit();

    expect(registry.getAllProviders().map((p) => p.name)).toEqual([
      "deepgram",
      "mock",
    ]);
  });
});

describe("STTSessionManager / STTEngineService", () => {
  let registry: STTProviderRegistry;
  let manager: STTSessionManager;
  let engine: STTEngineService;
  let stream: {
    id: string;
    writeAudioChunk: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  let streamParams: STTStreamParams;

  beforeEach(() => {
    registry = new STTProviderRegistry();
    stream = {
      id: "stream-1",
      writeAudioChunk: vi.fn(),
      end: vi.fn(async () => ({
        fullTranscript: "hi",
        language: "en",
        durationMs: 65_000,
        wordCount: 1,
      })),
      close: vi.fn(),
    } as never;
    registry.register({
      name: "mock",
      supportedLanguages: ["en"],
      validateConfig: () => true,
      createStream: (p: STTStreamParams) => {
        streamParams = p;
        return stream as unknown as STTStream;
      },
    });
    manager = new STTSessionManager(registry);
    engine = new STTEngineService(manager, registry);
  });

  it("creates one session per client with low-latency settings", () => {
    const client = fakeClient();
    const session = engine.startSession("u1", client, undefined, "es");

    expect(session).toMatchObject({
      userId: "u1",
      clientId: "socket-1",
      language: "es",
    });
    expect(streamParams).toMatchObject({
      interimResults: true,
      endpointing: 300,
      utteranceEndMs: 3000,
    });
    expect(engine.hasActiveSession("socket-1")).toBe(true);
  });

  it("passes the configured model to the provider", () => {
    engine.startSession("u1", fakeClient(), undefined, "es", "r1", "nova-2");
    expect(streamParams).toMatchObject({ model: "nova-2", language: "es" });
  });

  it("forwards transcript events to the client socket", () => {
    const client = fakeClient();
    engine.startSession("u1", client);

    streamParams.onPartialTranscript("hello", false);
    streamParams.onUtteranceEnd();

    expect(client.emit).toHaveBeenCalledWith(
      "stt:partial",
      expect.objectContaining({ text: "hello", isFinal: false }),
    );
    expect(client.emit).toHaveBeenCalledWith(
      "stt:utterance_end",
      expect.any(Object),
    );
  });

  it("closes the session and notifies the client on stream errors", () => {
    const client = fakeClient();
    engine.startSession("u1", client);

    streamParams.onError(new Error("provider down"));

    expect(client.emit).toHaveBeenCalledWith("stt:error", {
      code: "STREAM_ERROR",
      message: "provider down",
    });
    expect(engine.hasActiveSession("socket-1")).toBe(false);
    expect(stream.close).toHaveBeenCalled();
  });

  it("enforces the 3-minute hard limit", () => {
    vi.useFakeTimers();
    const client = fakeClient();
    engine.startSession("u1", client);

    vi.advanceTimersByTime(180_000);

    expect(client.emit).toHaveBeenCalledWith("stt:error", {
      code: "SESSION_TIMEOUT",
      message: "Recording limit reached (3 minutes max)",
    });
    expect(engine.hasActiveSession("socket-1")).toBe(false);
  });

  it("replaces an existing session for the same client", () => {
    const client = fakeClient();
    const first = engine.startSession("u1", client);
    const second = engine.startSession("u1", client);

    expect(second.sessionId).not.toBe(first.sessionId);
    expect(stream.close).toHaveBeenCalledTimes(1);
  });

  it("routes audio to the client's stream", () => {
    engine.startSession("u1", fakeClient());

    expect(engine.writeAudioChunk("socket-1", Buffer.from([1]))).toBe(true);
    expect(engine.writeAudioChunk("other", Buffer.from([1]))).toBe(false);
    expect(stream.writeAudioChunk).toHaveBeenCalledTimes(1);
  });

  it("ends the session and returns the final transcript", async () => {
    engine.startSession("u1", fakeClient());

    const result = await engine.endSession("socket-1");

    expect(result?.fullTranscript).toBe("hi");
    expect(engine.hasActiveSession("socket-1")).toBe(false);
    expect(await engine.endSession("socket-1")).toBeNull();
  });

  it("still closes the session when finishing the stream fails", async () => {
    stream.end.mockRejectedValue(new Error("flush failed"));
    engine.startSession("u1", fakeClient());

    expect(await engine.endSession("socket-1")).toBeNull();
    expect(engine.hasActiveSession("socket-1")).toBe(false);
  });

  it("tags every event with the client's requestId", () => {
    const client = fakeClient();
    engine.startSession("u1", client, undefined, "es", "req-7");
    streamParams.onPartialTranscript("hola", false);
    streamParams.onUtteranceEnd();
    streamParams.onError(new Error("boom"));
    const calls = (client.emit as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map(([event]) => event)).toEqual([
      "stt:partial",
      "stt:utterance_end",
      "stt:error",
    ]);
    for (const [, payload] of calls) {
      expect(payload).toMatchObject({ requestId: "req-7" });
    }
  });

  it("tells the client when the provider closes the stream on its own", () => {
    const client = fakeClient();
    engine.startSession("u1", client, undefined, "es", "req-8");
    streamParams.onUnexpectedClose!({ code: 1011, reason: "NET-0001" });
    expect(client.emit).toHaveBeenCalledWith("stt:error", {
      code: "PROVIDER_CLOSED",
      message: "The voice connection was interrupted",
      requestId: "req-8",
    });
    expect(engine.hasActiveSession("socket-1")).toBe(false);
  });

  it("logs why every session closed", async () => {
    const log = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    engine.startSession("u1", fakeClient());
    await engine.closeSession("socket-1", "client-disconnected");
    engine.startSession("u1", fakeClient());
    await engine.endSession("socket-1");
    const closes = log.mock.calls.filter(([m]) => m === "STT session closed");
    expect(
      closes.map(([, meta]) => (meta as { reason: string }).reason),
    ).toEqual(["client-disconnected", "ended-by-client"]);
  });

  it("a late error of an old session can't close the new one", () => {
    const client = fakeClient();
    engine.startSession("u1", client);
    const oldParams = streamParams;
    engine.startSession("u1", client); // replaces it
    oldParams.onError(new Error("old stream died"));
    expect(engine.hasActiveSession("socket-1")).toBe(true);
  });

  it("finishing a session never closes a new one started meanwhile", async () => {
    let finish!: (value: unknown) => void;
    stream.end.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    const client = fakeClient();
    engine.startSession("u1", client, undefined, "es", "req-1");
    const ending = engine.endSession("socket-1"); // Deepgram flushing…
    engine.startSession("u1", client, undefined, "es", "req-2"); // next turn
    finish({
      fullTranscript: "hola",
      language: "es",
      durationMs: 900,
      wordCount: 1,
    });

    expect(await ending).toMatchObject({
      fullTranscript: "hola",
      requestId: "req-1",
    });
    expect(engine.hasActiveSession("socket-1")).toBe(true);
  });

  it("fails clearly when no provider is available", () => {
    const empty = new STTEngineService(
      new STTSessionManager(new STTProviderRegistry()),
      registry,
    );
    expect(() => empty.startSession("u1", fakeClient())).toThrow(
      "No STT provider available",
    );
  });

  it.each([
    [1, 60, 1],
    [1000, 60, 1],
    [2300, 60, 3],
    [4200, 120, 10],
    [30_000, 1.2, 1],
    [179_000, 60, 179],
  ])(
    "bills %d ms at %d cr/min as %d credit(s) (every started second)",
    (ms, rate, credits) => {
      expect(engine.calculateCredits(ms, rate)).toBe(credits);
    },
  );

  it("never charges at a free rate (0) or for no audio", () => {
    expect(engine.calculateCredits(90_000, 0)).toBe(0);
    expect(engine.calculateCredits(0, 60)).toBe(0);
  });

  it("reports availability from the registry", () => {
    expect(engine.isAvailable()).toBe(true);
    expect(
      new STTEngineService(manager, new STTProviderRegistry()).isAvailable(),
    ).toBe(false);
  });
});
