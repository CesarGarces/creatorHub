/**
 * Browser-side limits of the AI Video Analyzer & Smart Clipper. The server
 * re-validates what it receives (tools/video-clipper/backend).
 */

/** Largest file processed in the browser (object URL + canvas). */
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

/** Roadmap: heavy camera files, not available yet. */
export const HEAVY_FILES_ROADMAP_BYTES = 10 * 1024 * 1024 * 1024;

/** Keyframes sampled per video (more for longer videos). */
export const MIN_KEYFRAMES = 6;
export const MAX_KEYFRAMES = 32;

/** Longest edge of a keyframe sent to the model, and its JPEG quality. */
export const KEYFRAME_MAX_EDGE = 512;
export const KEYFRAME_QUALITY = 0.7;
/** Server limit for one keyframe data URL (~450 KB). */
export const MAX_KEYFRAME_DATA_URL_CHARS = 600_000;

export const CLIP_PLATFORMS = [
  "youtube-shorts",
  "tiktok",
  "instagram-reels",
  "youtube",
] as const;
export type ClipPlatform = (typeof CLIP_PLATFORMS)[number];

/** Clip length (seconds) per platform — same rules as the server. */
export const CLIP_LENGTH_RULES: Record<
  ClipPlatform,
  { min: number; max: number }
> = {
  "youtube-shorts": { min: 5, max: 60 },
  tiktok: { min: 5, max: 90 },
  "instagram-reels": { min: 5, max: 90 },
  youtube: { min: 10, max: 180 },
};

/** Export framing: the source framing, or a 9:16 centre crop for Shorts/Reels/TikTok. */
export const EXPORT_FORMATS = ["original", "vertical"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Accepted extensions when the browser reports no MIME type. */
export const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "mkv", "ogv"];
