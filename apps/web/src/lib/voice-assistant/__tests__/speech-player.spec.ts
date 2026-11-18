import { describe, expect, it, vi } from "vitest";
import {
  SpeechPlayer,
  base64ToArrayBuffer,
  type SpeechSegment,
} from "../speech-player";

/** Minimal Web Audio fake: sources record when they start; end on demand. */
function fakeAudio() {
  const sources: Array<{
    buffer: { duration: number; tag: number } | null;
    startedAt: number | null;
    stopped: boolean;
    onended: (() => void) | null;
    start: (when: number) => void;
    stop: () => void;
    connect: () => void;
    end: () => void;
  }> = [];
  let level = 0;
  const context = {
    state: "suspended",
    currentTime: 10,
    destination: {},
    resume: vi.fn(async function (this: { state: string }) {
      this.state = "running";
    }),
    close: vi.fn(async () => undefined),
    createAnalyser: () => ({
      fftSize: 512,
      connect: vi.fn(),
      getFloatTimeDomainData: (data: Float32Array) => data.fill(level),
    }),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => {
      const bytes = new Uint8Array(data);
      if (bytes[0] === 0xff) throw new Error("undecodable");
      return { duration: bytes[0]! / 10, tag: bytes[0]! };
    }),
    createBufferSource: () => {
      const source = {
        buffer: null as { duration: number; tag: number } | null,
        startedAt: null as number | null,
        stopped: false,
        onended: null as (() => void) | null,
        start(when: number) {
          this.startedAt = when;
        },
        stop() {
          this.stopped = true;
        },
        connect: vi.fn(),
        end() {
          this.onended?.();
        },
      };
      sources.push(source);
      return source;
    },
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return {
    context,
    factory,
    sources,
    setLevel: (value: number) => (level = value),
  };
}

/** A "segment" whose first byte is its length in tenths of a second. */
const segment = (tenths: number): SpeechSegment => ({
  data: new Uint8Array([tenths, 1, 2]).buffer,
  mimeType: "audio/mpeg",
  durationMs: tenths * 100,
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("SpeechPlayer", () => {
  it("plays segments back to back, in arrival order", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    player.begin();
    player.enqueue(segment(20)); // 2 s
    player.enqueue(segment(5)); // 0.5 s
    player.enqueue(segment(10)); // 1 s
    await flush();

    expect(audio.sources.map((s) => s.buffer?.tag)).toEqual([20, 5, 10]);
    const [a, b, c] = audio.sources.map((s) => s.startedAt!);
    expect(a).toBeCloseTo(10.02);
    expect(b).toBeCloseTo(a! + 2);
    expect(c).toBeCloseTo(b! + 0.5);
  });

  it("reports the start, then the end after the last segment", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    const onStart = vi.fn();
    const onEnd = vi.fn();
    player.onStart(onStart);
    player.onEnd(onEnd);

    player.begin();
    player.enqueue(segment(10));
    await flush();
    expect(onStart).toHaveBeenCalledTimes(1);
    player.enqueue(segment(10));
    player.finish();
    await flush();
    audio.sources[0]!.end();
    expect(onEnd).not.toHaveBeenCalled();
    audio.sources[1]!.end();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(player.isActive).toBe(false);
  });

  it("signals when her voice runs out mid-reply (she's working)", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    const onDrain = vi.fn();
    const onEnd = vi.fn();
    player.onDrain(onDrain);
    player.onEnd(onEnd);
    player.begin();
    player.enqueue(segment(10));
    await flush();
    audio.sources[0]!.end(); // reply not finished: drained, not ended
    expect(onDrain).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();

    player.enqueue(segment(10));
    player.finish();
    await flush();
    audio.sources[1]!.end(); // the real end
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onDrain).toHaveBeenCalledTimes(1);
  });

  it("ends at once when a reply had no audio", () => {
    const player = new SpeechPlayer(fakeAudio().factory);
    const onEnd = vi.fn();
    player.onEnd(onEnd);
    player.begin();
    player.finish();
    expect(onEnd).toHaveBeenCalledTimes(1);
    player.finish(); // reported once
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("skips segments it can't decode", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    const onEnd = vi.fn();
    player.onEnd(onEnd);
    player.begin();
    player.enqueue(segment(0xff));
    player.enqueue(segment(10));
    player.finish();
    await flush();
    expect(audio.sources.map((s) => s.buffer?.tag)).toEqual([10]);
    audio.sources[0]!.end();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("stops at once on barge-in, without reporting an end", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    const onEnd = vi.fn();
    player.onEnd(onEnd);
    player.begin();
    player.enqueue(segment(10));
    await flush();
    player.enqueue(segment(10)); // still decoding when stopped
    player.stop();
    await flush();

    expect(audio.sources).toHaveLength(1);
    expect(audio.sources[0]!.stopped).toBe(true);
    expect(player.isActive).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("replays saved segments", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    player.replay([segment(3), segment(4)]);
    await flush();
    expect(audio.sources.map((s) => s.buffer?.tag)).toEqual([3, 4]);
  });

  it("unlocks (resumes) the audio context from a gesture", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    await player.unlock();
    expect(audio.context.resume).toHaveBeenCalled();
    expect(audio.factory).toHaveBeenCalledTimes(1);
  });

  it("measures the level of what is playing", async () => {
    const audio = fakeAudio();
    const player = new SpeechPlayer(audio.factory);
    expect(player.level()).toBe(0);
    player.begin();
    player.enqueue(segment(10));
    await flush();
    audio.setLevel(0.1);
    expect(player.level()).toBeCloseTo(0.4);
    audio.setLevel(0.9);
    expect(player.level()).toBe(1);
  });

  it("is silent without Web Audio but still ends (the talk goes on)", () => {
    const player = new SpeechPlayer(null);
    const onEnd = vi.fn();
    player.onEnd(onEnd);
    expect(player.isSupported).toBe(false);
    player.begin();
    player.enqueue(segment(10));
    player.finish();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(player.level()).toBe(0);
  });
});

describe("base64ToArrayBuffer", () => {
  it("decodes base64 audio", () => {
    expect([...new Uint8Array(base64ToArrayBuffer("AQID"))]).toEqual([1, 2, 3]);
  });
});
