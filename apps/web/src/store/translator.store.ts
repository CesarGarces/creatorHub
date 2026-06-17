import { create } from "zustand";

export type GenerationStatus =
  | "IDLE"
  | "GENERATING"
  | "REVEALING"
  | "READY"
  | "FAILED";

export interface TranslatorState {
  status: GenerationStatus;
  jobId: string | null;
  inputText: string;
  targetLanguage: string;
  provider: string;
  outputText: string | null;
  translationId: string | null;
  error: string | null;

  setInputText: (text: string) => void;
  setTargetLanguage: (lang: string) => void;
  setProvider: (provider: string) => void;
  startTranslation: (toolId: string, jobId: string) => void;
  setRevealing: (content: string, translationId: string) => void;
  setReady: () => void;
  setFailed: (error: string) => void;
  reset: () => void;
}

export const useTranslatorStore = create<TranslatorState>()((set, get) => ({
  status: "IDLE",
  jobId: null,
  inputText: "",
  targetLanguage: "es",
  provider: "deepseek-v4",
  outputText: null,
  translationId: null,
  error: null,

  setInputText: (inputText) => set({ inputText }),
  setTargetLanguage: (targetLanguage) => set({ targetLanguage }),
  setProvider: (provider) => set({ provider }),

  startTranslation: (_toolId: string, jobId: string) => {
    set({
      status: "GENERATING",
      outputText: null,
      translationId: null,
      error: null,
      jobId,
    });
  },

  setRevealing: (content: string, translationId: string) => {
    set({
      status: "REVEALING",
      outputText: content,
      translationId,
    });
  },

  setReady: () => {
    set({ status: "READY" });
  },

  setFailed: (error: string) => {
    set({ status: "FAILED", error });
  },

  reset: () => {
    set({
      status: "IDLE",
      outputText: null,
      translationId: null,
      error: null,
      jobId: null,
    });
  },
}));
