import type {
  Keyframe,
  VideoAnalysisResult,
  VideoAnalysisSummary,
  VideoHighlight,
} from "@/lib/video-clipper/types";

/** Keyframe thumbnail: a coloured frame with its timestamp (no network). */
function frame(timestamp: number, hue: number): Keyframe {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="288"><rect width="512" height="288" fill="hsl(${hue} 45% 28%)"/><circle cx="256" cy="144" r="70" fill="hsl(${hue} 70% 60%)"/><text x="20" y="270" font-family="monospace" font-size="28" fill="white">${timestamp}s</text></svg>`;
  return {
    timestamp,
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  };
}

export const CLIPPER_DURATION = 185;

export const CLIPPER_KEYFRAMES: Keyframe[] = Array.from(
  { length: 20 },
  (_, i) =>
    frame(
      Math.round((i + 0.5) * (CLIPPER_DURATION / 20) * 10) / 10,
      (i * 37) % 360,
    ),
);

export const CLIPPER_HIGHLIGHTS: VideoHighlight[] = [
  {
    id: "h1",
    start: 8,
    end: 34,
    title: "Only 2 ingredients for perfect pasta dough",
    hook: "You don't need a machine for this",
    reason:
      "Clear promise in the first seconds and a satisfying visual payoff.",
    score: 78,
    tags: ["recipe", "pasta"],
  },
  {
    id: "h2",
    start: 71,
    end: 112,
    title: "The sauce trick restaurants don't tell you",
    hook: "Nobody tells you this about pasta water",
    reason: "Curiosity gap + a reveal at the end: strong retention.",
    score: 93,
    tags: ["tips"],
  },
  {
    id: "h3",
    start: 150,
    end: 176,
    title: "First bite reaction",
    hook: "Was it worth it?",
    reason: "Emotional close, good loop back to the start.",
    score: 61,
    tags: [],
  },
];

export const CLIPPER_RESULT: VideoAnalysisResult = {
  summary:
    "A home cook makes fresh pasta from scratch, reveals a sauce trick with starchy pasta water and tastes the result.",
  contentType: "tutorial",
  highlights: CLIPPER_HIGHLIGHTS,
  hooks: [
    { text: "Stop buying dry pasta", style: "bold-claim" },
    { text: "Why does restaurant pasta taste better?", style: "question" },
    { text: "I made pasta every day for a month", style: "story" },
  ],
  titles: [
    { text: "Fresh pasta in 10 minutes (no machine)", platform: "youtube" },
    { text: "The pasta water trick nobody uses", platform: "tiktok" },
    { text: "Restaurant pasta at home, explained", platform: null },
  ],
  hashtags: ["#pasta", "#homecooking", "#recipe", "#foodtok"],
  platform: "youtube-shorts",
  language: "en",
  video: {
    fileName: "pasta-vlog.mp4",
    durationSec: CLIPPER_DURATION,
    width: 1920,
    height: 1080,
  },
  frames: 20,
  model: { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
};

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

export const CLIPPER_HISTORY: VideoAnalysisSummary[] = [
  {
    id: "va1",
    fileName: "pasta-vlog.mp4",
    durationSec: CLIPPER_DURATION,
    frameCount: 20,
    modelId: "google/gemini-2.5-flash",
    creditsCharged: 8,
    highlights: 3,
    topTitle: "Fresh pasta in 10 minutes (no machine)",
    createdAt: hoursAgo(2),
  },
  {
    id: "va2",
    fileName: "gaming-session-final-cut.mov",
    durationSec: 1420,
    frameCount: 32,
    modelId: "google/gemini-2.5-flash",
    creditsCharged: 12,
    highlights: 6,
    topTitle: null,
    createdAt: hoursAgo(50),
  },
];
