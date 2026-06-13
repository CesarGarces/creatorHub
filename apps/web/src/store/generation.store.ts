import { create } from "zustand";

export type GenerationStatus = "IDLE" | "GENERATING" | "REVEALING" | "READY" | "FAILED";

interface GenerationState {
  status: GenerationStatus;
  imageUrl: string | null;
  imageId: string | null;
  error: string | null;
  jobId: string | null;

  prompt: string;
  negativePrompt: string;
  style: string;
  aiProvider: string;

  setPrompt: (prompt: string) => void;
  setNegativePrompt: (negativePrompt: string) => void;
  setStyle: (style: string) => void;
  setAiProvider: (provider: string) => void;
  startGeneration: (jobId: string) => void;
  setReady: (url: string, imageId: string) => void;
  setFailed: (error: string) => void;
  markRevealed: () => void;
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

export const useGenerationStore = create<GenerationState>()((set, get) => ({
  status: "IDLE",
  imageUrl: null,
  imageId: null,
  error: null,
  jobId: null,

  prompt: "",
  negativePrompt: "",
  style: "bold",
  aiProvider: "gemini",

  setPrompt: (prompt) => set({ prompt }),
  setNegativePrompt: (negativePrompt) => set({ negativePrompt }),
  setStyle: (style) => set({ style }),
  setAiProvider: (aiProvider) => set({ aiProvider }),

  startGeneration: (jobId: string) => {
    set({
      status: "GENERATING",
      imageUrl: null,
      imageId: null,
      error: null,
      jobId,
    });
  },

  setReady: async (url: string, imageId: string) => {
    set({ status: "REVEALING", imageUrl: url, imageId });

    try {
      await preloadImage(url);
      set({ status: "READY" });
    } catch {
      set({ status: "FAILED", error: "Image failed to load" });
    }
  },

  setFailed: (error: string) => {
    set({ status: "FAILED", error });
  },

  markRevealed: () => {
    if (get().status === "REVEALING") {
      set({ status: "READY" });
    }
  },

  reset: () => {
    set({
      status: "IDLE",
      imageUrl: null,
      imageId: null,
      error: null,
      jobId: null,
    });
  },
}));
