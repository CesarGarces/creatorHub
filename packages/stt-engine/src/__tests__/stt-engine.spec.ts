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
    send: (data: Buffer) => void;
    close: ReturnType<typeof vi.fn>;
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
    close = vi.fn(() => {
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
    send(data: Buffer) {
      this.sent.push(data);
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
      interim_results: "false",
      endpointing: "500",
      utterance_end_ms: "3000",
    });
    expect(socket!.headers.Authorization).toBe("Token dg-test-key");
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
    expect(socket.close).toHaveBeenCalledWith(1000, "stream ended");
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
    [1, 1],
    [60_000, 1],
    [60_001, 2],
    [179_000, 3],
  ])("bills %d ms of audio as %d credit(s)", (ms, credits) => {
    expect(engine.calculateCredits(ms)).toBe(credits);
  });

  it("reports availability from the registry", () => {
    expect(engine.isAvailable()).toBe(true);
    expect(
      new STTEngineService(manager, new STTProviderRegistry()).isAvailable(),
    ).toBe(false);
  });
});
