import { create } from "zustand";

export type VideoGenerationStatus =
  | "IDLE"
  | "GENERATING"
  | "REVEALING"
  | "READY"
  | "FAILED";

export interface VideoVariation {
  url: string;
  videoId: string;
}

export interface BaseVideoState {
  status: VideoGenerationStatus;
  jobId: string | null;
  toolId: string | null;
  resultUrl: string | null;
  resultId: string | null;
  error: string | null;
  variations: VideoVariation[];

  startGeneration: (toolId: string, jobId: string) => void;
  setRevealing: (url: string, id: string) => void;
  setReady: () => void;
  setFailed: (error: string) => void;
  reset: () => void;
  addVariation: (url: string, videoId: string) => void;
}

export interface VideoFormState {
  prompt: string;
  aiProvider: string;
  aspectRatio: string;
  model: string;

  setPrompt: (prompt: string) => void;
  setAiProvider: (provider: string) => void;
  setAspectRatio: (ratio: string) => void;
  setModel: (model: string) => void;
}

export type VideoStore = BaseVideoState & VideoFormState;

export const useVideoStore = create<VideoStore>()((set, get) => ({
  status: "IDLE",
  jobId: null,
  toolId: null,
  resultUrl: null,
  resultId: null,
  error: null,
  variations: [],

  prompt: "",
  aiProvider: "siliconflow-video",
  aspectRatio: "16:9",
  model: "Wan-AI/Wan2.2-T2V-A14B",

  setPrompt: (prompt) => set({ prompt }),
  setAiProvider: (aiProvider) => set({ aiProvider }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setModel: (model) => set({ model }),

  startGeneration: (toolId, jobId) => {
    set({
      status: "GENERATING",
      resultUrl: null,
      resultId: null,
      error: null,
      jobId,
      toolId,
    });
  },

  setRevealing: (url, id) => {
    set({ status: "REVEALING", resultUrl: url, resultId: id });
  },

  setReady: () => {
    set({ status: "READY" });
  },

  setFailed: (error) => {
    set({ status: "FAILED", error });
  },

  addVariation: (url, videoId) => {
    set((state) => {
      const exists = state.variations.some((v) => v.url === url);
      if (exists) return state;
      return {
        variations: [{ url, videoId }, ...state.variations].slice(0, 10),
      };
    });
  },

  reset: () => {
    set({
      status: "IDLE",
      resultUrl: null,
      resultId: null,
      error: null,
      jobId: null,
      toolId: null,
    });
  },
}));
