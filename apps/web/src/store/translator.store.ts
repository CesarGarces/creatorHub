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

  isListening: boolean;
  liveTranscript: string;
  liveTranscriptFinal: string;

  setInputText: (text: string) => void;
  setTargetLanguage: (lang: string) => void;
  setProvider: (provider: string) => void;
  startTranslation: (toolId: string, jobId: string) => void;
  setRevealing: (content: string, translationId: string) => void;
  setReady: () => void;
  setFailed: (error: string) => void;
  setListening: (listening: boolean) => void;
  appendLiveTranscript: (text: string, isFinal: boolean) => void;
  commitLiveTranscript: () => void;
  reset: () => void;
  resetForm: () => void;
  resetAll: () => void;
}

export const useTranslatorStore = create<TranslatorState>()((set, get) => ({
  status: "IDLE",
  jobId: null,
  inputText: "",
  targetLanguage: "es",
  provider: "",
  outputText: null,
  translationId: null,
  error: null,

  isListening: false,
  liveTranscript: "",
  liveTranscriptFinal: "",

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

  setListening: (isListening) => set({ isListening }),

  appendLiveTranscript: (text: string, isFinal: boolean) => {
    const state = get();
    if (isFinal) {
      const newFinal = state.liveTranscriptFinal
        ? state.liveTranscriptFinal + " " + text
        : text;
      set({
        liveTranscriptFinal: newFinal,
        liveTranscript: "",
        inputText: newFinal,
      });
    } else {
      set({ liveTranscript: text });
    }
  },

  commitLiveTranscript: () => {
    const state = get();
    if (state.liveTranscript) {
      const newFinal = state.liveTranscriptFinal
        ? state.liveTranscriptFinal + " " + state.liveTranscript
        : state.liveTranscript;
      set({
        liveTranscriptFinal: newFinal,
        liveTranscript: "",
        inputText: newFinal,
      });
    }
  },

  reset: () => {
    set({
      status: "IDLE",
      outputText: null,
      translationId: null,
      error: null,
      jobId: null,
      liveTranscript: "",
      liveTranscriptFinal: "",
      isListening: false,
    });
  },

  resetForm: () => {
    set({
      inputText: "",
      targetLanguage: "es",
      provider: "",
    });
  },

  resetAll: () => {
    set({
      status: "IDLE",
      jobId: null,
      inputText: "",
      targetLanguage: "es",
      provider: "",
      outputText: null,
      translationId: null,
      error: null,
      isListening: false,
      liveTranscript: "",
      liveTranscriptFinal: "",
    });
  },
}));
