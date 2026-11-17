import { create } from "zustand";
import api from "@/lib/api";
import { localizeError } from "@/i18n/errors";
import type { ClipPlatform } from "@/lib/video-clipper/constants";
import type {
  AnalysisEstimate,
  ClipRange,
  Keyframe,
  LocalVideoInfo,
  VideoAnalysisResult,
  VideoAnalysisSummary,
} from "@/lib/video-clipper/types";

const BASE = "/tools/video-clipper";

export interface LoadedAnalysis {
  id: string;
  result: VideoAnalysisResult;
  /** Set right after a run (not when reopened from history). */
  creditsCharged?: number;
}

export interface AnalyzeParams {
  model: string;
  video: LocalVideoInfo;
  frames: Keyframe[];
  platform: ClipPlatform;
  language: string;
  context?: string;
  signal?: AbortSignal;
}

interface VideoClipperState {
  model: string;
  platform: ClipPlatform;
  context: string;

  estimate: AnalysisEstimate | null;

  isAnalyzing: boolean;
  analysis: LoadedAnalysis | null;
  /** Clip in/out points, starting from the AI's and trimmed by the user. */
  ranges: Record<string, ClipRange>;
  error: string | null;

  history: VideoAnalysisSummary[];
  historyLoaded: boolean;

  setModel: (model: string) => void;
  setPlatform: (platform: ClipPlatform) => void;
  setContext: (context: string) => void;
  setRange: (clipId: string, range: ClipRange) => void;
  resetRange: (clipId: string) => void;

  fetchEstimate: (model: string, frames: number) => Promise<void>;
  analyze: (params: AnalyzeParams) => Promise<LoadedAnalysis | null>;
  fetchHistory: (force?: boolean) => Promise<void>;
  openAnalysis: (id: string) => Promise<void>;
  deleteAnalysis: (id: string) => Promise<boolean>;
  /** Drop an analysis deleted elsewhere (e.g. discarded on leave) from the state. */
  forgetAnalysis: (id: string) => void;
  clearAnalysis: () => void;
  clearError: () => void;
}

function rangesOf(result: VideoAnalysisResult): Record<string, ClipRange> {
  return Object.fromEntries(
    result.highlights.map((h) => [h.id, { start: h.start, end: h.end }]),
  );
}

export const useVideoClipperStore = create<VideoClipperState>()((set, get) => ({
  model: "",
  platform: "youtube-shorts",
  context: "",
  estimate: null,
  isAnalyzing: false,
  analysis: null,
  ranges: {},
  error: null,
  history: [],
  historyLoaded: false,

  setModel: (model) => set({ model }),
  setPlatform: (platform) => set({ platform }),
  setContext: (context) => set({ context }),
  setRange: (clipId, range) =>
    set((s) => ({ ranges: { ...s.ranges, [clipId]: range } })),
  resetRange: (clipId) => {
    const clip = get().analysis?.result.highlights.find((h) => h.id === clipId);
    if (clip) get().setRange(clipId, { start: clip.start, end: clip.end });
  },

  fetchEstimate: async (model, frames) => {
    if (!model || frames < 1) {
      set({ estimate: null });
      return;
    }
    try {
      const res = await api.get<{ data: AnalysisEstimate }>(
        `${BASE}/estimate`,
        { params: { model, frames: String(frames) } },
      );
      // Ignore answers for a model that is no longer selected.
      if (get().model === model) set({ estimate: res.data });
    } catch {
      set({ estimate: null });
    }
  },

  analyze: async ({
    model,
    video,
    frames,
    platform,
    language,
    context,
    signal,
  }) => {
    if (get().isAnalyzing) return null;
    set({ isAnalyzing: true, error: null });
    try {
      const res = await api.post<{
        data: {
          analysisId: string;
          result: VideoAnalysisResult;
          creditsCharged: number;
        };
      }>(
        `${BASE}/analyses`,
        {
          model,
          platform,
          language,
          context: context?.trim() || undefined,
          video: {
            fileName: video.fileName,
            durationSec: video.durationSec,
            width: video.width || undefined,
            height: video.height || undefined,
            sizeBytes: video.sizeBytes,
            mimeType: video.mimeType || undefined,
          },
          frames: frames.map((f) => ({
            timestamp: f.timestamp,
            image: f.dataUrl,
          })),
        },
        { signal },
      );
      const analysis: LoadedAnalysis = {
        id: res.data.analysisId,
        result: res.data.result,
        creditsCharged: res.data.creditsCharged,
      };
      set({
        analysis,
        ranges: rangesOf(analysis.result),
        isAnalyzing: false,
        historyLoaded: false,
      });
      void get().fetchHistory(true);
      return analysis;
    } catch (err) {
      const aborted = signal?.aborted;
      set({
        isAnalyzing: false,
        error: aborted
          ? null
          : localizeError(err, "videoClipper.errors.failed"),
      });
      return null;
    }
  },

  fetchHistory: async (force = false) => {
    if (get().historyLoaded && !force) return;
    try {
      const res = await api.get<{ data: VideoAnalysisSummary[] }>(
        `${BASE}/analyses`,
        { params: { limit: "10" } },
      );
      set({ history: res.data, historyLoaded: true });
    } catch {
      // History is secondary: the tool works without it.
    }
  },

  openAnalysis: async (id) => {
    try {
      const res = await api.get<{
        data: { id: string; result: VideoAnalysisResult };
      }>(`${BASE}/analyses/${id}`);
      set({
        analysis: { id: res.data.id, result: res.data.result },
        ranges: rangesOf(res.data.result),
        platform: res.data.result.platform,
        error: null,
      });
    } catch (err) {
      set({ error: localizeError(err, "videoClipper.errors.openFailed") });
    }
  },

  deleteAnalysis: async (id) => {
    try {
      await api.delete(`${BASE}/analyses/${id}`);
      set((s) => ({
        history: s.history.filter((h) => h.id !== id),
        ...(s.analysis?.id === id ? { analysis: null, ranges: {} } : {}),
      }));
      return true;
    } catch (err) {
      set({ error: localizeError(err, "videoClipper.errors.deleteFailed") });
      return false;
    }
  },

  forgetAnalysis: (id) =>
    set((s) => ({
      history: s.history.filter((h) => h.id !== id),
      ...(s.analysis?.id === id ? { analysis: null, ranges: {} } : {}),
    })),

  clearAnalysis: () => set({ analysis: null, ranges: {}, error: null }),
  clearError: () => set({ error: null }),
}));
