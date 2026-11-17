/**
 * Local video ingest: validation and metadata, read from an object URL.
 * The file never leaves the device.
 */
import {
  HEAVY_FILES_ROADMAP_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_EXTENSIONS,
} from "./constants";
import { KeyframeExtractionError, waitForEvent } from "./keyframes";

export type VideoFileCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "type" | "empty" | "size";
      /**
       * Over the 250 MB browser limit but within the roadmap's 10 GB for
       * heavy camera files (coming in a future release).
       */
      heavy: boolean;
    };

/** Can this file be processed in the browser? */
export function checkVideoFile(file: {
  name: string;
  type: string;
  size: number;
}): VideoFileCheck {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isVideo = file.type
    ? file.type.startsWith("video/")
    : VIDEO_EXTENSIONS.includes(extension);
  if (!isVideo) return { ok: false, reason: "type", heavy: false };
  if (file.size <= 0) return { ok: false, reason: "empty", heavy: false };
  if (file.size > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      reason: "size",
      heavy: file.size <= HEAVY_FILES_ROADMAP_BYTES,
    };
  }
  return { ok: true };
}

export interface VideoMetadata {
  durationSec: number;
  width: number;
  height: number;
}

/**
 * Duration and resolution of the video at `url`. Some recordings (e.g.
 * MediaRecorder WebM) report an infinite duration until the end is sought.
 */
export async function readVideoMetadata(
  url: string,
  timeoutMs = 15_000,
): Promise<VideoMetadata> {
  const video = document.createElement("video");
  video.muted = true;
  video.preload = "metadata";
  video.src = url;
  try {
    await waitForEvent(video, "loadedmetadata", timeoutMs);
    let duration = video.duration;
    if (!Number.isFinite(duration)) {
      const ready = waitForEvent(video, "durationchange", timeoutMs);
      video.currentTime = Number.MAX_SAFE_INTEGER;
      await ready.catch(() => undefined);
      duration = video.duration;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new KeyframeExtractionError("The video has no duration");
    }
    // Audio-only files (or a video track the browser can't decode) would
    // give black keyframes and a useless, paid analysis.
    if (!video.videoWidth || !video.videoHeight) {
      throw new KeyframeExtractionError("The video has no picture");
    }
    return {
      durationSec: Math.round(duration * 100) / 100,
      width: video.videoWidth,
      height: video.videoHeight,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
