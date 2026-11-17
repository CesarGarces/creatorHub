/**
 * Types of the AI Video Analyzer & Smart Clipper
 * (mirror of tools/video-clipper/backend/src/video-clipper.types.ts).
 */
import type { ClipPlatform } from "./constants";

export interface VideoHighlight {
  id: string;
  /** Seconds from the start of the video. */
  start: number;
  end: number;
  title: string;
  hook: string;
  reason: string;
  /** Predicted engagement, 0–100. */
  score: number;
  tags: string[];
}

export interface HookSuggestion {
  text: string;
  style: string | null;
}

export interface TitleSuggestion {
  text: string;
  platform: string | null;
}

export interface VideoAnalysisResult {
  summary: string;
  contentType: string | null;
  highlights: VideoHighlight[];
  hooks: HookSuggestion[];
  titles: TitleSuggestion[];
  hashtags: string[];
  platform: ClipPlatform;
  language: string;
  video: {
    fileName: string;
    durationSec: number;
    width: number | null;
    height: number | null;
  };
  frames: number;
  model: { id: string; name: string };
}

export interface AnalysisEstimate {
  modelId: string;
  modelName: string;
  modelCost: number;
  frames: number;
  units: number;
  total: number;
}

export interface VideoAnalysisSummary {
  id: string;
  fileName: string;
  durationSec: number;
  frameCount: number;
  modelId: string;
  creditsCharged: number;
  highlights: number;
  topTitle: string | null;
  createdAt: string;
}

/** A keyframe sampled in the browser. */
export interface Keyframe {
  timestamp: number;
  /** `data:image/jpeg;base64,...` (also used as the thumbnail). */
  dataUrl: string;
}

/** What the browser read from the local file. */
export interface LocalVideoInfo {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  durationSec: number;
  width: number;
  height: number;
}

/** A clip's current in/out points (the AI's, possibly trimmed by the user). */
export interface ClipRange {
  start: number;
  end: number;
}
