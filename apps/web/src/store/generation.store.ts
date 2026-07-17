import { create } from "zustand";

export type GenerationStatus =
  | "IDLE"
  | "GENERATING"
  | "REVEALING"
  | "READY"
  | "FAILED";

// ─── Base State (reusable for ANY tool) ──────────────────────────────────────
export interface Variation {
  url: string;
  imageId: string;
}

export interface BaseGenerationState {
  status: GenerationStatus;
  jobId: string | null;
  toolId: string | null;
  resultUrl: string | null;
  resultId: string | null;
  error: string | null;
  variations: Variation[];

  startGeneration: (toolId: string, jobId: string) => void;
  setRevealing: (url: string, id: string) => void;
  setReady: () => void;
  setFailed: (error: string) => void;
  reset: () => void;
  resetForm: () => void;
  resetAll: () => void;
  addVariation: (url: string, imageId: string) => void;
}

// ─── Thumbnail-specific form state ───────────────────────────────────────────
export interface ThumbnailFormState {
  prompt: string;
  negativePrompt: string;
  style: string;
  aiProvider: string;
  providerSlug: string;
  width: number;
  height: number;
  sourceImageUrl: string | null;

  setPrompt: (prompt: string) => void;
  setNegativePrompt: (prompt: string) => void;
  setStyle: (style: string) => void;
  setAiProvider: (provider: string) => void;
  setProviderSlug: (slug: string) => void;
  setDimensions: (width: number, height: number) => void;
  setSourceImageUrl: (url: string | null) => void;
}

// ─── Combined store type ─────────────────────────────────────────────────────
export type GenerationStore = BaseGenerationState & ThumbnailFormState;

export const useGenerationStore = create<GenerationStore>()((set, get) => ({
  // Base state
  status: "IDLE",
  jobId: null,
  toolId: null,
  resultUrl: null,
  resultId: null,
  error: null,
  variations: [],

  // Thumbnail form state
  prompt: "",
  negativePrompt: "",
  style: "bold",
  aiProvider: "",
  providerSlug: "",
  width: 1280,
  height: 720,
  sourceImageUrl: null,

  // Thumbnail form setters
  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  setStyle: (style) => set({ style }),
  setAiProvider: (aiProvider) => set({ aiProvider }),
  setProviderSlug: (providerSlug) => set({ providerSlug }),
  setDimensions: (width, height) => set({ width, height }),
  setSourceImageUrl: (sourceImageUrl) => set({ sourceImageUrl }),

  // Base actions
  startGeneration: (toolId: string, jobId: string) => {
    set({
      status: "GENERATING",
      resultUrl: null,
      resultId: null,
      error: null,
      jobId,
      toolId,
    });
  },

  setRevealing: (url: string, id: string) => {
    set({ status: "REVEALING", resultUrl: url, resultId: id });
  },

  setReady: async () => {
    const { resultUrl } = get();
    if (!resultUrl) return;

    set({ status: "READY" });
  },

  setFailed: (error: string) => {
    set({ status: "FAILED", error });
  },

  addVariation: (url: string, imageId: string) => {
    set((state) => {
      const exists = state.variations.some((v) => v.url === url);
      if (exists) return state;
      return {
        variations: [{ url, imageId }, ...state.variations].slice(0, 10),
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
    });
  },

  resetForm: () => {
    set({
      prompt: "",
      negativePrompt: "",
      style: "bold",
      aiProvider: "",
      providerSlug: "",
      width: 1280,
      height: 720,
      sourceImageUrl: null,
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
      negativePrompt: "",
      style: "bold",
      aiProvider: "",
      providerSlug: "",
      width: 1280,
      height: 720,
      sourceImageUrl: null,
    });
  },
}));
