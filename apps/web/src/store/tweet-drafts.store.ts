import { create } from "zustand";
import api from "@/lib/api";

export interface TweetDraftMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface TweetDraftSession {
  id: string;
  topic: string;
  content: string;
  status: "DRAFT" | "PREVIEW" | "PUBLISHED" | "FAILED";
  publishedTweetId?: string | null;
  publishedAt?: string | null;
  model?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TweetDraftsState {
  sessions: TweetDraftSession[];
  activeSession: TweetDraftSession | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  fetchSessions: () => Promise<void>;
  selectSession: (sessionId: string) => void;
  createSession: (draft: TweetDraftSession) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  clearActiveSession: () => void;
  updateSessionStatus: (
    sessionId: string,
    status: "PUBLISHED" | "FAILED",
    publishedTweetId?: string,
  ) => void;
}

export const useTweetDraftsStore = create<TweetDraftsState>()((set, get) => ({
  sessions: [],
  activeSession: null,
  isLoading: false,
  isGenerating: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{
        success: boolean;
        data: TweetDraftSession[];
      }>("/social/tweets/drafts");
      set({ sessions: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  selectSession: (sessionId: string) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (session) {
      set({ activeSession: session });
    }
  },

  createSession: (draft: TweetDraftSession) => {
    set((state) => ({
      sessions: [draft, ...state.sessions],
      activeSession: draft,
    }));
  },

  deleteSession: async (sessionId: string) => {
    try {
      await api.delete(`/social/tweets/drafts/${sessionId}`);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        activeSession:
          state.activeSession?.id === sessionId ? null : state.activeSession,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  clearActiveSession: () => set({ activeSession: null }),

  updateSessionStatus: (
    sessionId: string,
    status: "PUBLISHED" | "FAILED",
    publishedTweetId?: string,
  ) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              status,
              publishedTweetId: publishedTweetId || s.publishedTweetId,
              publishedAt:
                status === "PUBLISHED"
                  ? new Date().toISOString()
                  : s.publishedAt,
            }
          : s,
      ),
      activeSession:
        state.activeSession?.id === sessionId
          ? {
              ...state.activeSession,
              status,
              publishedTweetId:
                publishedTweetId || state.activeSession.publishedTweetId,
              publishedAt:
                status === "PUBLISHED"
                  ? new Date().toISOString()
                  : state.activeSession.publishedAt,
            }
          : state.activeSession,
    }));
  },
}));
