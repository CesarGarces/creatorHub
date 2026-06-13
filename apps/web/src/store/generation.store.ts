import { create } from "zustand";

export type GenerationStatus = "IDLE" | "GENERATING" | "REVEALING" | "READY" | "FAILED";

// ─── Base State (reusable for ANY tool) ──────────────────────────────────────
export interface BaseGenerationState {
  status: GenerationStatus;
  jobId: string | null;
  toolId: string | null;
  resultUrl: string | null;
  resultId: string | null;
  error: string | null;

  startGeneration: (toolId: string, jobId: string) => void;
  setRevealing: (url: string, id: string) => void;
  setReady: () => void;
  setFailed: (error: string) => void;
  reset: () => void;
}

const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to preload image"));
    img.src = url;
  });
};

// ─── Thumbnail-specific form state ───────────────────────────────────────────
export interface ThumbnailFormState {
  prompt: string;
  negativePrompt: string;
  style: string;
  aiProvider: string;

  setPrompt: (prompt: string) => void;
  setNegativePrompt: (negativePrompt: string) => void;
  setStyle: (style: string) => void;
  setAiProvider: (provider: string) => void;
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

  // Thumbnail form state
  prompt: "",
  negativePrompt: "",
  style: "bold",
  aiProvider: "gemini",

  // Thumbnail form setters
  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  setStyle: (style) => set({ style }),
  setAiProvider: (aiProvider) => set({ aiProvider }),

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

    try {
      await preloadImage(resultUrl);
      set({ status: "READY" });
    } catch {
      set({ status: "FAILED", error: "Image failed to load" });
    }
  },

  setFailed: (error: string) => {
    set({ status: "FAILED", error });
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
