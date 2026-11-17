import type { AnalysisLanguage, ClipPlatform } from "./video-clipper.constants";

/** A keyframe sampled in the browser. */
export interface VideoKeyframe {
  /** Seconds from the start of the video. */
  timestamp: number;
  /** `data:image/jpeg;base64,...` */
  image: string;
}

/** What the browser knows about the local file (the file is not uploaded). */
export interface VideoMetadata {
  fileName: string;
  durationSec: number;
  width?: number;
  height?: number;
  sizeBytes?: number;
  mimeType?: string;
}

/** A moment worth clipping. Times are seconds, rounded to 0.1 s. */
export interface VideoHighlight {
  id: string;
  start: number;
  end: number;
  /** Short, catchy clip title. */
  title: string;
  /** Opening line / on-screen text for the first seconds of the clip. */
  hook: string;
  /** Why this moment should perform. */
  reason: string;
  /** Predicted engagement, 0–100. */
  score: number;
  tags: string[];
}

export interface HookSuggestion {
  text: string;
  /** e.g. "question", "bold-claim", "curiosity-gap" */
  style: string | null;
}

export interface TitleSuggestion {
  text: string;
  platform: string | null;
}

/** Structured JSON returned to the web and stored in `VideoAnalysis.result`. */
export interface VideoAnalysisResult {
  summary: string;
  contentType: string | null;
  highlights: VideoHighlight[];
  hooks: HookSuggestion[];
  titles: TitleSuggestion[];
  hashtags: string[];
  platform: ClipPlatform;
  language: AnalysisLanguage;
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
  /** `ModelMetadata.creditCost` of the vision model. */
  modelCost: number;
  frames: number;
  /** Started batches of `FRAMES_PER_CREDIT_UNIT` keyframes. */
  units: number;
  total: number;
}

/** Row of the history list. */
export interface VideoAnalysisSummary {
  id: string;
  fileName: string;
  durationSec: number;
  frameCount: number;
  modelId: string;
  creditsCharged: number;
  highlights: number;
  topTitle: string | null;
  createdAt: Date;
}
