/**
 * Limits and catalogues of the AI Video Analyzer & Smart Clipper.
 *
 * The video itself never reaches the server: the browser samples compressed
 * keyframes (canvas → JPEG data URLs) and sends only those plus metadata.
 * These limits validate that payload.
 */

export const VIDEO_CLIPPER_TOOL_ID = "video-clipper";

/** Largest video the browser pipeline accepts (checked client-side too). */
export const MAX_VIDEO_BYTES = 250 * 1024 * 1024;

/** Roadmap: heavy camera files (server/worker pipeline) — not available yet. */
export const HEAVY_FILES_ROADMAP_BYTES = 10 * 1024 * 1024 * 1024;

/** Longest video accepted (6 h — a 250 MB file can be a long, low-bitrate one). */
export const MAX_DURATION_SEC = 6 * 60 * 60;

/** Keyframes per analysis (the web samples 6–32 depending on the duration). */
export const MIN_FRAMES = 1;
export const MAX_FRAMES = 32;

/** One keyframe as a data URL: ~450 KB of JPEG/PNG/WebP at most. */
export const MAX_FRAME_DATA_URL_CHARS = 600_000;
export const FRAME_DATA_URL_PATTERN =
  /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Pricing: the vision model's `creditCost` (Admin → AI Models) per started
 * batch of keyframes — more frames means more image tokens for the model.
 */
export const FRAMES_PER_CREDIT_UNIT = 12;

/** Where the clips will be published: drives the clip length rules. */
export const CLIP_PLATFORMS = [
  "youtube-shorts",
  "tiktok",
  "instagram-reels",
  "youtube",
] as const;
export type ClipPlatform = (typeof CLIP_PLATFORMS)[number];

/** Clip length (seconds) allowed per platform. */
export const CLIP_LENGTH_RULES: Record<
  ClipPlatform,
  { min: number; max: number; label: string }
> = {
  "youtube-shorts": {
    min: 5,
    max: 60,
    label: "YouTube Shorts (vertical, ≤ 60 s)",
  },
  tiktok: { min: 5, max: 90, label: "TikTok (vertical, ≤ 90 s)" },
  "instagram-reels": {
    min: 5,
    max: 90,
    label: "Instagram Reels (vertical, ≤ 90 s)",
  },
  youtube: {
    min: 10,
    max: 180,
    label: "YouTube (teasers / chapters, ≤ 3 min)",
  },
};

export const ANALYSIS_LANGUAGES = ["en", "es", "pt"] as const;
export type AnalysisLanguage = (typeof ANALYSIS_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<AnalysisLanguage, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
};

/** Caps applied to the model's reply. */
export const MAX_HIGHLIGHTS = 8;
export const MAX_HOOKS = 6;
export const MAX_TITLES = 6;
export const MAX_HASHTAGS = 12;

/** Optional creator notes about the video ("what is it about?"). */
export const MAX_CONTEXT_CHARS = 500;
