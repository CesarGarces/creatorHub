/**
 * Browser pipelines (keyframes, metadata, clip export) driven by real DOM
 * elements with fake media behaviour: jsdom has no decoding, canvas,
 * MediaRecorder or WebAudio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractKeyframes,
  isAbortError,
  KeyframeExtractionError,
} from "../keyframes";
import { readVideoMetadata } from "../video-file";
import { ClipExportError, downloadBlob, exportClip } from "../clip-export";

const realCreateElement = document.createElement.bind(document);

interface FakeVideoOptions {
  duration?: number;
  width?: number;
  height?: number;
  /** Media time advanced per playback tick (5 ms). */
  step?: number;
  /** Fire a media error instead of loading. */
  failToLoad?: boolean;
}

function fakeVideo(opts: FakeVideoOptions = {}) {
  const video = realCreateElement("video");
  let time = 0;
  let duration = opts.duration ?? 60;
  let playing: ReturnType<typeof setInterval> | undefined;
  let ended = false;
  const seeks: number[] = [];
  Object.defineProperties(video, {
    duration: { get: () => duration, configurable: true },
    videoWidth: { get: () => opts.width ?? 1920 },
    videoHeight: { get: () => opts.height ?? 1080 },
    readyState: { get: () => 4 },
    ended: { get: () => ended },
    currentTime: {
      get: () => time,
      set: (value: number) => {
        seeks.push(value);
        if (value >= Number.MAX_SAFE_INTEGER) {
          duration = 42.5;
          setTimeout(() => video.dispatchEvent(new Event("durationchange")), 0);
          return;
        }
        time = value;
        setTimeout(() => video.dispatchEvent(new Event("seeked")), 0);
      },
    },
    src: {
      get: () => "blob:fake",
      set: () => {
        setTimeout(() => {
          if (opts.failToLoad) video.dispatchEvent(new Event("error"));
          else {
            video.dispatchEvent(new Event("loadedmetadata"));
            video.dispatchEvent(new Event("loadeddata"));
          }
        }, 0);
      },
    },
  });
  video.play = vi.fn(async () => {
    clearInterval(playing);
    playing = setInterval(() => {
      time += opts.step ?? 1;
      if (time >= duration) {
        time = duration;
        ended = true;
        clearInterval(playing);
      }
    }, 5);
  });
  video.pause = vi.fn(() => clearInterval(playing));
  video.load = vi.fn();
  return { video, seeks };
}

function fakeCanvas(dataUrls?: (quality: number) => string) {
  const canvas = realCreateElement("canvas");
  const ctx = { drawImage: vi.fn() };
  const videoTrack = { kind: "video", stop: vi.fn() };
  canvas.getContext = vi.fn(() => ctx) as never;
  canvas.toDataURL = vi.fn(
    (_type?: string, quality?: number) =>
      dataUrls?.(quality ?? 1) ?? `data:image/jpeg;base64,Q${quality}`,
  );
  (canvas as unknown as { captureStream: unknown }).captureStream = vi.fn(
    () => ({
      getVideoTracks: () => [videoTrack],
    }),
  );
  return { canvas, ctx, videoTrack };
}

function mockElements(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "video") return video;
    if (tag === "canvas") return canvas;
    return realCreateElement(tag);
  }) as typeof document.createElement);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("extractKeyframes", () => {
  it("seeks to every timestamp and returns compressed JPEG keyframes", async () => {
    const { video, seeks } = fakeVideo({ width: 1920, height: 1080 });
    const { canvas, ctx } = fakeCanvas();
    mockElements(video, canvas);
    const progress: number[] = [];

    const frames = await extractKeyframes("blob:video", [5, 15, 25], {
      onProgress: (done) => progress.push(done),
    });

    expect(seeks).toEqual([5, 15, 25]);
    expect(canvas.width).toBe(512);
    expect(canvas.height).toBe(288);
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
    expect(frames).toEqual([
      { timestamp: 5, dataUrl: "data:image/jpeg;base64,Q0.7" },
      { timestamp: 15, dataUrl: "data:image/jpeg;base64,Q0.7" },
      { timestamp: 25, dataUrl: "data:image/jpeg;base64,Q0.7" },
    ]);
    expect(progress).toEqual([1, 2, 3]);
    expect(video.load).toHaveBeenCalled(); // released
  });

  it("re-encodes at lower quality when a keyframe is over the server limit", async () => {
    const { video } = fakeVideo();
    const { canvas } = fakeCanvas((q) =>
      q > 0.5
        ? `data:image/jpeg;base64,${"A".repeat(700_000)}`
        : "data:image/jpeg;base64,small",
    );
    mockElements(video, canvas);

    const [frame] = await extractKeyframes("blob:video", [1]);
    expect(frame!.dataUrl).toBe("data:image/jpeg;base64,small");
    expect(canvas.toDataURL).toHaveBeenCalledTimes(3); // 0.7 → 0.55 → 0.4
  });

  it("stops when aborted", async () => {
    const { video } = fakeVideo();
    const { canvas } = fakeCanvas();
    mockElements(video, canvas);
    const controller = new AbortController();

    const promise = extractKeyframes("blob:video", [1, 2, 3], {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    });
    const error = await promise.catch((e: unknown) => e);
    expect(isAbortError(error)).toBe(true);
  });

  it("fails with a decode error for unreadable videos", async () => {
    const { video } = fakeVideo({ failToLoad: true });
    const { canvas } = fakeCanvas();
    mockElements(video, canvas);
    await expect(extractKeyframes("blob:video", [1])).rejects.toBeInstanceOf(
      KeyframeExtractionError,
    );
  });
});

describe("readVideoMetadata", () => {
  it("reads duration and resolution", async () => {
    const { video } = fakeVideo({
      duration: 125.456,
      width: 1080,
      height: 1920,
    });
    mockElements(video, fakeCanvas().canvas);
    await expect(readVideoMetadata("blob:video")).resolves.toEqual({
      durationSec: 125.46,
      width: 1080,
      height: 1920,
    });
  });

  it("rejects files without a decodable picture (audio-only, unsupported codec)", async () => {
    const { video } = fakeVideo({ width: 0, height: 0 });
    mockElements(video, fakeCanvas().canvas);
    await expect(readVideoMetadata("blob:video")).rejects.toBeInstanceOf(
      KeyframeExtractionError,
    );
  });

  it("resolves an infinite duration (MediaRecorder WebM) by seeking to the end", async () => {
    const { video } = fakeVideo({ duration: Infinity });
    mockElements(video, fakeCanvas().canvas);
    await expect(readVideoMetadata("blob:video")).resolves.toMatchObject({
      durationSec: 42.5,
    });
  });
});

describe("exportClip", () => {
  class FakeRecorder {
    static instances: FakeRecorder[] = [];
    static isTypeSupported = (type: string) =>
      type === "video/webm;codecs=vp9,opus";
    state: "inactive" | "recording" | "paused" = "inactive";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(
      public stream: { getTracks: () => unknown[] },
      public options: Record<string, unknown>,
    ) {
      FakeRecorder.instances.push(this);
    }
    start = vi.fn(() => {
      this.state = "recording";
    });
    pause = vi.fn(() => {
      this.state = "paused";
    });
    resume = vi.fn(() => {
      this.state = "recording";
    });
    stop = vi.fn(() => {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["clip-bytes"]) });
      setTimeout(() => this.onstop?.(), 0);
    });
  }

  const audioTrack = { kind: "audio", stop: vi.fn() };
  const audio = {
    source: { connect: vi.fn() },
    close: vi.fn(async () => undefined),
  };

  beforeEach(() => {
    FakeRecorder.instances = [];
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    vi.stubGlobal(
      "MediaStream",
      class {
        constructor(private tracks: unknown[]) {}
        getTracks() {
          return this.tracks;
        }
      },
    );
    vi.stubGlobal(
      "AudioContext",
      class {
        createMediaElementSource = vi.fn(() => audio.source);
        createMediaStreamDestination = vi.fn(() => ({
          stream: { getAudioTracks: () => [audioTrack] },
        }));
        resume = vi.fn(async () => undefined);
        close = audio.close;
      },
    );
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) =>
      setTimeout(cb, 1),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    (
      HTMLCanvasElement.prototype as unknown as { captureStream: unknown }
    ).captureStream = () => undefined;
  });

  afterEach(() => {
    delete (
      HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }
    ).captureStream;
  });

  it("records the segment with audio into the best supported container", async () => {
    const { video, seeks } = fakeVideo({
      duration: 60,
      width: 1920,
      height: 1080,
    });
    const { canvas, ctx, videoTrack } = fakeCanvas();
    mockElements(video, canvas);
    const progress: number[] = [];

    const clip = await exportClip({
      url: "blob:video",
      start: 10,
      end: 20,
      format: "vertical",
      onProgress: (p) => progress.push(p),
    });

    const recorder = FakeRecorder.instances[0]!;
    expect(recorder.options).toMatchObject({
      mimeType: "video/webm;codecs=vp9,opus",
    });
    expect(recorder.stream.getTracks()).toEqual([videoTrack, audioTrack]);
    expect(recorder.start).toHaveBeenCalled();
    expect(recorder.stop).toHaveBeenCalled();
    expect(seeks[0]).toBe(10);
    // 9:16 centre crop of a 1920×1080 source.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      video,
      656,
      0,
      608,
      1080,
      0,
      0,
      608,
      1080,
    );
    expect(clip).toMatchObject({
      mimeType: "video/webm",
      extension: "webm",
      width: 608,
      height: 1080,
    });
    expect(clip.blob.size).toBe("clip-bytes".length);
    expect(clip.blob.type).toBe("video/webm");
    expect(progress.at(-1)).toBe(1);
    expect(video.currentTime).toBeGreaterThanOrEqual(20);
    // Audio goes to the recording only, and everything is released.
    expect(audio.source.connect).toHaveBeenCalled();
    expect(videoTrack.stop).toHaveBeenCalled();
    expect(audioTrack.stop).toHaveBeenCalled();
    expect(audio.close).toHaveBeenCalled();
    expect(video.isConnected).toBe(false);
  });

  it("can be cancelled", async () => {
    const { video } = fakeVideo({ duration: 600, step: 0.01 });
    const { canvas } = fakeCanvas();
    mockElements(video, canvas);
    const controller = new AbortController();

    const promise = exportClip({
      url: "blob:video",
      start: 0,
      end: 500,
      format: "original",
      signal: controller.signal,
      onProgress: (p) => {
        if (p > 0) controller.abort();
      },
    });
    const error = await promise.catch((e: unknown) => e);
    expect(isAbortError(error)).toBe(true);
    expect(FakeRecorder.instances[0]!.stop).toHaveBeenCalled();
    expect(video.isConnected).toBe(false);
  });

  it("refuses when the browser can't record", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    await expect(
      exportClip({ url: "blob:video", start: 0, end: 5, format: "original" }),
    ).rejects.toBeInstanceOf(ClipExportError);
  });
});

describe("downloadBlob", () => {
  it("downloads through a temporary link and revokes the URL later", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:download");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL, revokeObjectURL }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    downloadBlob(new Blob(["x"]), "clip.mp4");

    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("clip.mp4");
    expect(link.href).toBe("blob:download");
    expect(link.isConnected).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
    vi.useRealTimers();
  });
});
