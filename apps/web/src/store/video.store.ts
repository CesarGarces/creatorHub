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
  resetForm: () => void;
  resetAll: () => void;
  addVariation: (url: string, videoId: string) => void;
}

export type VideoQuality = "480p" | "720p" | "1080p" | "4k";

export interface VideoFormState {
  prompt: string;
  aiProvider: string;
  aspectRatio: string;
  model: string;
  imageUrl: string | null;
  duration: number;
  audioEnabled: boolean;
  quality: VideoQuality;

  setPrompt: (prompt: string) => void;
  setAiProvider: (provider: string) => void;
  setAspectRatio: (ratio: string) => void;
  setModel: (model: string) => void;
  setImageUrl: (url: string | null) => void;
  setDuration: (duration: number) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setQuality: (quality: VideoQuality) => void;
}

export type VideoStore = BaseVideoState & VideoFormState;

export const useVideoStore = create<VideoStore>()((set, _get) => ({
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
  imageUrl: null,
  duration: 4,
  audioEnabled: true,
  quality: "720p",

  setPrompt: (prompt) => set({ prompt }),
  setAiProvider: (aiProvider) => set({ aiProvider }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setModel: (model) => set({ model }),
  setImageUrl: (imageUrl) => set({ imageUrl }),
  setDuration: (duration) => set({ duration }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setQuality: (quality) => set({ quality }),

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
      variations: [],
      imageUrl: null,
    });
  },

  resetForm: () => {
    set({
      prompt: "",
      aiProvider: "siliconflow-video",
      aspectRatio: "16:9",
      model: "Wan-AI/Wan2.2-T2V-A14B",
      imageUrl: null,
      duration: 4,
      audioEnabled: true,
      quality: "720p",
    });
  },

  resetAll: () => {
    set({
      status: "IDLE",
      resultUrl: null,
      resultId: null,
      error: null,
      jobId: null,
      toolId: null,
      variations: [],
      prompt: "",
      aiProvider: "siliconflow-video",
      aspectRatio: "16:9",
      model: "Wan-AI/Wan2.2-T2V-A14B",
      imageUrl: null,
      duration: 4,
      audioEnabled: true,
      quality: "720p",
    });
  },
}));
