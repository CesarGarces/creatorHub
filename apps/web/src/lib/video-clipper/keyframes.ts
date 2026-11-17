/**
 * Keyframe sampling, entirely in the browser: the video plays from a local
 * object URL into a detached <video>, frames are drawn onto a <canvas> and
 * exported as small JPEG data URLs. Nothing is uploaded here.
 */
import {
  KEYFRAME_MAX_EDGE,
  KEYFRAME_QUALITY,
  MAX_KEYFRAME_DATA_URL_CHARS,
  MAX_KEYFRAMES,
  MIN_KEYFRAMES,
} from "./constants";
import type { Keyframe } from "./types";

/**
 * How many keyframes a video gets: grows with the log of the duration, so
 * short clips stay cheap and long videos are still covered.
 * 15 s → 9 · 1 min → 14 · 3 min → 20 · 10 min → 28 · ≥ 17 min → 32.
 * Videos shorter than 6 s get one frame per second.
 */
export function keyframeCount(durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  if (durationSec < MIN_KEYFRAMES) return Math.max(1, Math.ceil(durationSec));
  const count = Math.round(6 + 5 * Math.log2(1 + durationSec / 30));
  return Math.min(MAX_KEYFRAMES, Math.max(MIN_KEYFRAMES, count));
}

/**
 * Evenly spread timestamps (centre of each slice: never the black first
 * frame or the last one, which some files can't decode), rounded to 0.1 s.
 */
export function planKeyframeTimestamps(durationSec: number): number[] {
  const count = keyframeCount(durationSec);
  const slice = durationSec / count;
  return Array.from(
    { length: count },
    (_, i) => Math.round((i + 0.5) * slice * 10) / 10,
  );
}

/** Canvas size for a keyframe: the source scaled so its longest edge ≤ `maxEdge`. */
export function keyframeSize(
  width: number,
  height: number,
  maxEdge = KEYFRAME_MAX_EDGE,
): { width: number; height: number } {
  if (!width || !height) return { width: maxEdge, height: maxEdge };
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

export class KeyframeExtractionError extends Error {}

export interface ExtractOptions {
  maxEdge?: number;
  quality?: number;
  signal?: AbortSignal;
  /** Called after each frame: (done, total, frame) — lets the UI fill in. */
  onProgress?: (done: number, total: number, frame: Keyframe) => void;
  /** Per-seek timeout (ms). */
  seekTimeoutMs?: number;
}

/** Samples `timestamps` from the video at `url` (an object URL). */
export async function extractKeyframes(
  url: string,
  timestamps: number[],
  options: ExtractOptions = {},
): Promise<Keyframe[]> {
  const {
    maxEdge = KEYFRAME_MAX_EDGE,
    quality = KEYFRAME_QUALITY,
    signal,
    onProgress,
    seekTimeoutMs = 15_000,
  } = options;

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await waitForEvent(video, "loadeddata", seekTimeoutMs, signal);
    // iOS Safari only paints frames of a video that has played once.
    try {
      await video.play();
      video.pause();
    } catch {
      // Autoplay refused: seeking still works on other browsers.
    }

    const size = keyframeSize(video.videoWidth, video.videoHeight, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new KeyframeExtractionError("Canvas is not available");

    const frames: Keyframe[] = [];
    for (const timestamp of timestamps) {
      throwIfAborted(signal);
      await seek(video, timestamp, seekTimeoutMs, signal);
      ctx.drawImage(video, 0, 0, size.width, size.height);
      const frame = { timestamp, dataUrl: toJpeg(canvas, quality) };
      frames.push(frame);
      onProgress?.(frames.length, timestamps.length, frame);
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}

/** JPEG data URL, re-encoded at lower quality if it's over the server limit. */
function toJpeg(canvas: HTMLCanvasElement, quality: number): string {
  let q = quality;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > MAX_KEYFRAME_DATA_URL_CHARS && q > 0.3) {
    q -= 0.15;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

async function seek(
  video: HTMLVideoElement,
  time: number,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  const target = Math.min(
    Math.max(0, time),
    Math.max(0, (video.duration || time) - 0.05),
  );
  if (Math.abs(video.currentTime - target) < 0.01 && video.readyState >= 2) {
    return;
  }
  const seeked = waitForEvent(video, "seeked", timeoutMs, signal);
  video.currentTime = target;
  await seeked;
}

/** Resolves on `event`, rejects on media error, timeout or abort. */
export function waitForEvent(
  target: HTMLMediaElement,
  event: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new KeyframeExtractionError("The video could not be decoded"));
    };
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new KeyframeExtractionError(`Timed out waiting for "${event}"`));
    }, timeoutMs);
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
