import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import {
  DeepgramTTSError,
  DeepgramTTSProvider,
} from "../providers/deepgram-tts.provider";
import { MockTTSProvider } from "../providers/mock-tts.provider";
import { TTSProviderRegistry } from "../providers/tts-provider.registry";
import { TTSProviderFactory } from "../providers/tts-provider.factory";
import { TTSEngineService } from "../tts-engine.service";
import {
  estimateSpeechMs,
  mp3DurationMs,
  readMp3Frame,
  silentWav,
  wavDurationMs,
} from "../audio-format";

/**
 * A CBR MP3 made of `frames` MPEG-2 Layer III frames at 48 kbps / 24 kHz
 * (what Aura-2 returns): 144 bytes and 24 ms each.
 */
function mp3(frames: number, { id3 = false } = {}): Buffer {
  // FF F3: sync + MPEG-2 + Layer III + no CRC. 0x64: bitrate idx 6 (48 kbps),
  // sample rate idx 1 (24 kHz), no padding.
  const header = [0xff, 0xf3, 0x64, 0xc4];
  const frame = Buffer.alloc(144);
  Buffer.from(header).copy(frame);
  const parts = Array.from({ length: frames }, () => frame);
  if (id3) {
    // "ID3" v2.4, 20-byte tag body (syncsafe size).
    const tag = Buffer.alloc(30);
    tag.write("ID3", 0, "ascii");
    tag[3] = 4;
    tag[9] = 20;
    parts.unshift(tag);
  }
  return Buffer.concat(parts);
}

function response(
  body: Buffer | object,
  init: { status?: number; ok?: boolean } = {},
): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    arrayBuffer: async () =>
      Buffer.isBuffer(body)
        ? body.buffer.slice(body.byteOffset, body.byteOffset + body.length)
        : new ArrayBuffer(0),
    json: async () => {
      if (Buffer.isBuffer(body)) throw new Error("not json");
      return body;
    },
  } as unknown as Response;
}

describe("audio-format", () => {
  it("reads MPEG-2 Layer III frame headers", () => {
    expect(readMp3Frame(mp3(1), 0)).toEqual({
      length: 144,
      samples: 576,
      sampleRate: 24000,
    });
    expect(readMp3Frame(Buffer.from([0, 1, 2, 3]), 0)).toBeNull();
  });

  it("measures MP3 speech from its frames (24 ms each)", () => {
    expect(mp3DurationMs(mp3(125))).toBe(3000);
    expect(mp3DurationMs(mp3(2500))).toBe(60_000);
  });

  it("skips a leading ID3 tag and junk between frames", () => {
    expect(mp3DurationMs(mp3(50, { id3: true }))).toBe(1200);
    const withJunk = Buffer.concat([mp3(10), Buffer.from([1, 2, 3]), mp3(10)]);
    expect(mp3DurationMs(withJunk)).toBe(480);
  });

  it("falls back to the bitrate when there are no frames", () => {
    expect(mp3DurationMs(Buffer.alloc(6000), 48_000)).toBe(1000);
  });

  it("writes silent WAVs of the requested length and reads them back", () => {
    const wav = silentWav(1500);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wavDurationMs(wav)).toBe(1500);
    expect(wavDurationMs(Buffer.from("nope"))).toBe(0);
  });

  it("estimates speaking time for the mock, at least 400 ms", () => {
    expect(estimateSpeechMs("Hi")).toBe(400);
    expect(estimateSpeechMs("a".repeat(140))).toBe(10_000);
  });
});

describe("DeepgramTTSProvider (Aura-2)", () => {
  const env = process.env.DEEPGRAM_API_KEY;
  beforeEach(() => {
    process.env.DEEPGRAM_API_KEY = "dg-key";
  });
  afterEach(() => {
    if (env === undefined) delete process.env.DEEPGRAM_API_KEY;
    else process.env.DEEPGRAM_API_KEY = env;
  });

  it.each([
    ["en", "aura-2-andromeda-en"],
    ["es", "aura-2-celeste-es"],
    ["pt", "aura-2-bianca-pt"],
  ] as const)("speaks %s with %s", async (language, model) => {
    const fetchMock = vi.fn(async () => response(mp3(125)));
    const provider = new DeepgramTTSProvider(fetchMock as never);

    const audio = await provider.synthesize({ text: " Hola ", language });

    const [url, init] = fetchMock.mock.calls[0]! as unknown as [
      string,
      RequestInit,
    ];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.deepgram.com/v1/speak",
    );
    expect(parsed.searchParams.get("model")).toBe(model);
    expect(parsed.searchParams.get("encoding")).toBe("mp3");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Token dg-key",
    );
    expect(JSON.parse(init.body as string)).toEqual({ text: "Hola" });
    expect(audio).toMatchObject({
      mimeType: "audio/mpeg",
      durationMs: 3000,
      voice: model,
      provider: "deepgram",
    });
    expect(audio.audio.length).toBe(125 * 144);
  });

  it("speaks with the voice set in Admin → Voice when given", async () => {
    const fetchMock = vi.fn(async () => response(mp3(25)));
    const provider = new DeepgramTTSProvider(fetchMock as never);
    const audio = await provider.synthesize({
      text: "Hola",
      language: "es",
      voice: "aura-2-javier-es",
    });
    const [url] = fetchMock.mock.calls[0]! as unknown as [string];
    expect(new URL(url).searchParams.get("model")).toBe("aura-2-javier-es");
    expect(audio.voice).toBe("aura-2-javier-es");
  });

  it("is configured only with DEEPGRAM_API_KEY", () => {
    expect(new DeepgramTTSProvider().validateConfig()).toBe(true);
    delete process.env.DEEPGRAM_API_KEY;
    expect(new DeepgramTTSProvider().validateConfig()).toBe(false);
  });

  it("rejects empty and over-long text without calling Deepgram", async () => {
    const fetchMock = vi.fn();
    const provider = new DeepgramTTSProvider(fetchMock as never);
    await expect(
      provider.synthesize({ text: "   ", language: "en" }),
    ).rejects.toThrow("Nothing to say");
    await expect(
      provider.synthesize({ text: "a".repeat(2001), language: "en" }),
    ).rejects.toThrow("2000 characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries once on a server error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ err_msg: "busy" }, { status: 503 }))
      .mockResolvedValueOnce(response(mp3(25)));
    const provider = new DeepgramTTSProvider(fetchMock as never);

    const audio = await provider.synthesize({ text: "Hi", language: "en" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(audio.durationMs).toBe(600);
  });

  it("does not retry client errors and reports Deepgram's message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response({ err_msg: "bad model" }, { status: 400 }));
    const provider = new DeepgramTTSProvider(fetchMock as never);

    const error = await provider
      .synthesize({ text: "Hi", language: "es" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeepgramTTSError);
    expect((error as DeepgramTTSError).status).toBe(400);
    expect((error as Error).message).toBe("Deepgram TTS error 400: bad model");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops when the caller aborts", async () => {
    const abort = new AbortController();
    abort.abort();
    const fetchMock = vi.fn();
    const provider = new DeepgramTTSProvider(fetchMock as never);
    await expect(
      provider.synthesize({
        text: "Hi",
        language: "en",
        signal: abort.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("MockTTSProvider", () => {
  it("returns silent WAV as long as the text would take", async () => {
    const audio = await new MockTTSProvider().synthesize({
      text: "a".repeat(28),
      language: "pt",
    });
    expect(audio).toMatchObject({
      mimeType: "audio/wav",
      durationMs: 2000,
      voice: "aura-2-bianca-pt",
      provider: "mock",
    });
    expect(wavDurationMs(audio.audio)).toBe(2000);
  });
});

describe("TTSProviderFactory", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("registers Deepgram when the key is set", () => {
    process.env.DEEPGRAM_API_KEY = "k";
    process.env.NODE_ENV = "production";
    const registry = new TTSProviderRegistry();
    new TTSProviderFactory(registry).onModuleInit();
    expect(registry.getAllProviders().map((p) => p.name)).toEqual(["deepgram"]);
  });

  it("has no voice in production without Deepgram (no silent mock)", () => {
    delete process.env.DEEPGRAM_API_KEY;
    process.env.NODE_ENV = "production";
    const registry = new TTSProviderRegistry();
    new TTSProviderFactory(registry).onModuleInit();
    expect(registry.getAllProviders()).toEqual([]);
    expect(new TTSEngineService(registry).isAvailable()).toBe(false);
  });

  it("adds the mock in development", () => {
    delete process.env.DEEPGRAM_API_KEY;
    process.env.NODE_ENV = "development";
    const registry = new TTSProviderRegistry();
    new TTSProviderFactory(registry).onModuleInit();
    expect(registry.getAvailableProvider()?.name).toBe("mock");
  });
});

describe("TTSEngineService", () => {
  it("speaks through the first configured provider", async () => {
    const registry = new TTSProviderRegistry();
    registry.register(new MockTTSProvider());
    const engine = new TTSEngineService(registry);

    expect(engine.isAvailable()).toBe(true);
    expect(engine.activeProvider()).toBe("mock");
    const audio = await engine.synthesize({ text: "Olá", language: "pt" });
    expect(audio.voice).toBe("aura-2-bianca-pt");
  });

  it("fails clearly without providers", async () => {
    const engine = new TTSEngineService(new TTSProviderRegistry());
    expect(engine.activeProvider()).toBeNull();
    await expect(
      engine.synthesize({ text: "Hi", language: "en" }),
    ).rejects.toThrow("No TTS provider available");
  });

  it("picks the voice from the language", () => {
    const engine = new TTSEngineService(new TTSProviderRegistry());
    expect(engine.voiceFor("es").name).toBe("Celeste");
    expect(engine.voiceFor("xx").name).toBe("Andromeda");
  });

  it("bills every started second of speech, nothing without speech", () => {
    const engine = new TTSEngineService(new TTSProviderRegistry());
    expect(engine.calculateCredits(0, 2)).toBe(0);
    expect(engine.calculateCredits(1, 2)).toBe(2);
    expect(engine.calculateCredits(4200, 2)).toBe(10);
    expect(engine.calculateCredits(60_000, 0.5)).toBe(30);
    expect(engine.calculateCredits(30_000, 0)).toBe(0);
  });
});
