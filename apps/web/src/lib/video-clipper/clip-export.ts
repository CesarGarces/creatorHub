/**
 * Client-side clip export. The segment plays from the local object URL into
 * an off-screen <video>; frames are painted onto a <canvas> (original
 * framing, or a 9:16 centre crop for Shorts/Reels/TikTok) and recorded with
 * MediaRecorder together with the audio, routed through WebAudio so nothing
 * is heard while exporting. Recording runs in real time: a 30 s clip takes
 * ~30 s. The result is downloaded straight to the device — no server.
 */
import type { ExportFormat } from "./constants";
import { abortError, waitForEvent } from "./keyframes";
import type { ClipRange } from "./types";

export interface RecorderFormat {
  mimeType: string;
  extension: "mp4" | "webm";
}

/**
 * H.264/AAC MP4 first (what social platforms prefer: Chrome ≥ 126, Safari),
 * then WebM (Firefox, Chromium builds without H.264), then MP4 with the
 * browser's default codecs (Safari's only option). A bare "video/mp4" is
 * tried after WebM because some Chromium builds accept it but put VP9 in it.
 */
const RECORDER_FORMATS: RecorderFormat[] = [
  { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", extension: "mp4" },
  { mimeType: "video/mp4;codecs=avc1,mp4a", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm", extension: "webm" },
];

/** Best container the browser can record, or null. */
export function pickRecorderFormat(
  isTypeSupported: (type: string) => boolean = defaultIsTypeSupported,
): RecorderFormat | null {
  return RECORDER_FORMATS.find((f) => isTypeSupported(f.mimeType)) ?? null;
}

function defaultIsTypeSupported(type: string): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof MediaRecorder.isTypeSupported === "function" &&
    MediaRecorder.isTypeSupported(type)
  );
}

/** MediaRecorder + canvas.captureStream() available (all evergreen browsers, iOS ≥ 15). */
export function isClipExportSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype &&
    pickRecorderFormat() !== null
  );
}

export interface ExportGeometry {
  /** Output size (even numbers, longest edge ≤ maxEdge). */
  width: number;
  height: number;
  /** Source rectangle painted into the output. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Source crop and output size for a format. */
export function exportGeometry(
  srcWidth: number,
  srcHeight: number,
  format: ExportFormat,
  maxEdge = 1920,
): ExportGeometry {
  let sx = 0;
  let sy = 0;
  let sw = srcWidth;
  let sh = srcHeight;
  if (format === "vertical") {
    const target = 9 / 16;
    if (srcWidth / srcHeight > target) {
      sw = srcHeight * target;
      sx = (srcWidth - sw) / 2;
    } else {
      sh = srcWidth / target;
      sy = (srcHeight - sh) / 2;
    }
  }
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  return {
    width: even(sw * scale),
    height: even(sh * scale),
    sx: Math.round(sx),
    sy: Math.round(sy),
    sw: Math.round(sw),
    sh: Math.round(sh),
  };
}

/** ~0.1 bit per pixel at 30 fps, between 1.5 and 8 Mbps. */
export function videoBitrate(width: number, height: number): number {
  return Math.round(
    Math.min(8_000_000, Math.max(1_500_000, width * height * 30 * 0.1)),
  );
}

/** "My Vlog (final).mp4", clip 2, 83–110 s → "my-vlog-final-clip-2-01m23s-01m50s.mp4". */
export function clipFileName(
  sourceName: string,
  index: number,
  range: ClipRange,
  extension: string,
): string {
  const base =
    sourceName
      .replace(/\.[^.]+$/, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "video";
  return `${base}-clip-${index}-${stamp(range.start)}-${stamp(range.end)}.${extension}`;
}

function stamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}h${m}m${s}s` : `${m}m${s}s`;
}

function even(value: number): number {
  return Math.max(2, Math.round(value / 2) * 2);
}

export class ClipExportError extends Error {}

export interface ExportClipOptions {
  /** Object URL of the local video. */
  url: string;
  start: number;
  end: number;
  format: ExportFormat;
  signal?: AbortSignal;
  /** 0 → 1 while the segment is recorded. */
  onProgress?: (ratio: number) => void;
}

export interface ExportedClip {
  blob: Blob;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

type AudioContextCtor = typeof AudioContext;

/** Records the [start, end] segment of the local video. */
export async function exportClip(
  options: ExportClipOptions,
): Promise<ExportedClip> {
  const { url, start, end, format, signal, onProgress } = options;
  const recorderFormat = pickRecorderFormat();
  if (!isClipExportSupported() || !recorderFormat) {
    throw new ClipExportError("Clip export is not supported in this browser");
  }
  if (!(end > start)) throw new ClipExportError("Invalid clip range");

  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");
  // Attached but invisible: some browsers don't decode detached videos.
  Object.assign(video.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "2px",
    height: "2px",
    opacity: "0",
    pointerEvents: "none",
  });
  video.src = url;
  document.body.appendChild(video);

  const tracks: MediaStreamTrack[] = [];
  let audioContext: AudioContext | null = null;
  let recorder: MediaRecorder | null = null;

  try {
    // Audio → recording only (not the speakers). Created first, inside the
    // user gesture that started the export (autoplay policies).
    const AudioCtor: AudioContextCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor })
        .webkitAudioContext;
    const audioTracks: MediaStreamTrack[] = [];
    if (AudioCtor) {
      audioContext = new AudioCtor();
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      audioTracks.push(...destination.stream.getAudioTracks());
      await audioContext.resume().catch(() => undefined);
    } else {
      video.muted = true; // video-only clip
    }

    await waitForEvent(video, "loadedmetadata", 15_000, signal);
    const geo = exportGeometry(video.videoWidth, video.videoHeight, format);
    const canvas = document.createElement("canvas");
    canvas.width = geo.width;
    canvas.height = geo.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ClipExportError("Canvas is not available");
    const draw = () =>
      ctx.drawImage(
        video,
        geo.sx,
        geo.sy,
        geo.sw,
        geo.sh,
        0,
        0,
        geo.width,
        geo.height,
      );

    const seeked = waitForEvent(video, "seeked", 15_000, signal);
    video.currentTime = start;
    await seeked;
    draw();

    const canvasStream = canvas.captureStream(30);
    const stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...audioTracks,
    ]);
    tracks.push(...stream.getTracks());
    recorder = new MediaRecorder(stream, {
      mimeType: recorderFormat.mimeType,
      videoBitsPerSecond: videoBitrate(geo.width, geo.height),
      audioBitsPerSecond: 128_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const activeRecorder = recorder;
    const stopped = new Promise<void>((resolve, reject) => {
      activeRecorder.onstop = () => resolve();
      activeRecorder.onerror = () =>
        reject(new ClipExportError("Recording failed"));
    });

    await playSegment(video, activeRecorder, {
      start,
      end,
      draw,
      signal,
      onProgress,
    });

    if (activeRecorder.state !== "inactive") activeRecorder.stop();
    await stopped;
    onProgress?.(1);

    const mimeType = recorderFormat.mimeType.split(";")[0]!;
    return {
      blob: new Blob(chunks, { type: mimeType }),
      mimeType,
      extension: recorderFormat.extension,
      width: geo.width,
      height: geo.height,
    };
  } catch (error) {
    if (recorder && recorder.state !== "inactive") recorder.stop();
    throw error;
  } finally {
    for (const track of tracks) track.stop();
    void audioContext?.close().catch(() => undefined);
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}

/**
 * Plays [start, end] while painting every animation frame. Hidden tabs
 * stop animation frames, so playback and recording pause together and
 * resume when the tab is visible again (no frozen gap in the clip).
 */
function playSegment(
  video: HTMLVideoElement,
  recorder: MediaRecorder,
  opts: {
    start: number;
    end: number;
    draw: () => void;
    signal?: AbortSignal;
    onProgress?: (ratio: number) => void;
  },
): Promise<void> {
  const { start, end, draw, signal, onProgress } = opts;
  return new Promise<void>((resolve, reject) => {
    let done = false;
    let frame = 0;
    const finish = (error?: Error | DOMException) => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      clearInterval(watchdog);
      video.pause();
      document.removeEventListener("visibilitychange", onVisibility);
      signal?.removeEventListener("abort", onAbort);
      video.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const reachedEnd = () => video.currentTime >= end || video.ended;
    const tick = () => {
      if (done) return;
      draw();
      onProgress?.(
        Math.min(1, Math.max(0, (video.currentTime - start) / (end - start))),
      );
      if (reachedEnd()) return finish();
      frame = requestAnimationFrame(tick);
    };
    const onAbort = () => finish(abortError());
    const onError = () =>
      finish(new ClipExportError("The video could not be decoded"));
    const onVisibility = () => {
      if (done) return;
      if (document.hidden) {
        video.pause();
        if (recorder.state === "recording") recorder.pause();
      } else {
        if (recorder.state === "paused") recorder.resume();
        video.play().then(
          () => (frame = requestAnimationFrame(tick)),
          () => finish(new ClipExportError("Playback was blocked")),
        );
      }
    };
    // Backup end check (animation frames can be throttled).
    const watchdog = setInterval(() => {
      if (reachedEnd()) finish();
    }, 200);

    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
    document.addEventListener("visibilitychange", onVisibility);
    video.addEventListener("error", onError, { once: true });

    recorder.start(500);
    video.play().then(
      () => {
        frame = requestAnimationFrame(tick);
      },
      () => finish(new ClipExportError("Playback was blocked")),
    );
  });
}

/** Saves a blob to the device (download attribute; works on iOS ≥ 13). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give slow devices time to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
