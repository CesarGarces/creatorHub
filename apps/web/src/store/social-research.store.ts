import { create } from "zustand";
import api from "@/lib/api";

export interface ResearchMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  resultData?: {
    topic: string;
    tweetCount: number;
    tweets: Array<{
      id: string;
      text: string;
      createdAt: string;
      author: {
        id: string;
        username: string;
        name: string;
        verified: boolean;
        followers: number;
      };
      metrics: {
        likes: number;
        retweets: number;
        replies: number;
        quotes: number;
        views?: number;
      };
      hashtags: string[];
      urls?: string[];
      media?: string[];
    }>;
    trendingHashtags: string[];
    formattedAnalysis: string;
    fromCache: boolean;
  } | null;
  provider: string | null;
  creditsUsed: number;
  cacheHit: boolean;
  createdAt: string;
}

export interface ResearchSession {
  id: string;
  toolId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ResearchMessage[];
  _count?: { messages: number };
}

interface SocialResearchState {
  sessions: ResearchSession[];
  activeSession: ResearchSession | null;
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  fetchSessions: (toolId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  createSession: (toolId: string) => Promise<ResearchSession>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  search: (
    toolId: string,
    params: Record<string, any>,
  ) => Promise<ResearchMessage>;
  clearActiveSession: () => void;
}

export const useSocialResearchStore = create<SocialResearchState>()(
  (set, get) => ({
    sessions: [],
    activeSession: null,
    isLoading: false,
    isSearching: false,
    error: null,

    fetchSessions: async (toolId: string) => {
      set({ isLoading: true, error: null });
      try {
        const sessions = await api.get<ResearchSession[]>(
          `/tools/social-research/sessions/${toolId}`,
        );
        set({ sessions, isLoading: false });
      } catch (error: any) {
        set({ error: error.message, isLoading: false });
      }
    },

    selectSession: async (sessionId: string) => {
      set({ isLoading: true, error: null });
      try {
        const session = get().sessions.find((s) => s.id === sessionId);
        if (session) {
          set({ activeSession: session, isLoading: false });
        }
      } catch (error: any) {
        set({ error: error.message, isLoading: false });
      }
    },

    createSession: async (toolId: string) => {
      try {
        const session = await api.post<ResearchSession>(
          `/tools/social-research/sessions/${toolId}`,
          {},
        );
        set((state) => ({
          sessions: [session, ...state.sessions],
          activeSession: session,
        }));
        return session;
      } catch (error: any) {
        set({ error: error.message });
        throw error;
      }
    },

    deleteSession: async (sessionId: string) => {
      try {
        await api.delete(`/tools/social-research/sessions/${sessionId}`);
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          activeSession:
            state.activeSession?.id === sessionId ? null : state.activeSession,
        }));
      } catch (error: any) {
        set({ error: error.message });
      }
    },

    updateSessionTitle: async (sessionId: string, title: string) => {
      try {
        await api.post(`/tools/social-research/sessions/${sessionId}/title`, {
          title,
        });
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title } : s,
          ),
          activeSession:
            state.activeSession?.id === sessionId
              ? { ...state.activeSession, title }
              : state.activeSession,
        }));
      } catch (error: any) {
        set({ error: error.message });
      }
    },

    search: async (toolId: string, params: Record<string, any>) => {
      const { activeSession } = get();
      set({ isSearching: true, error: null });

      try {
        const response = await api.post<{
          success: boolean;
          data: {
            topic: string;
            tweetCount: number;
            tweets: any[];
            trendingHashtags: string[];
            formattedAnalysis: string;
            fromCache: boolean;
            sessionId: string;
          };
        }>(`/tools/${toolId}/search`, {
          ...params,
          sessionId: activeSession?.id,
        });

        const result = response.data;

        set((state) => {
          const userMsg: ResearchMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: params.topic || params.prompt || "",
            resultData: null,
            provider: null,
            creditsUsed: 0,
            cacheHit: false,
            createdAt: new Date().toISOString(),
          };

          const assistantMsg: ResearchMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: result.formattedAnalysis || "",
            resultData: {
              topic: result.topic,
              tweetCount: result.tweetCount,
              tweets: result.tweets,
              trendingHashtags: result.trendingHashtags,
              formattedAnalysis: result.formattedAnalysis,
              fromCache: result.fromCache,
            },
            provider: "x",
            creditsUsed: params.cacheHit ? 0 : 15,
            cacheHit: result.fromCache,
            createdAt: new Date().toISOString(),
          };

          const updatedSession: ResearchSession = {
            id: result.sessionId || activeSession?.id || `new-${Date.now()}`,
            toolId,
            title:
              activeSession?.title ||
              params.topic?.slice(0, 50) ||
              params.prompt?.slice(0, 50) ||
              "New Research",
            createdAt: activeSession?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [
              ...(activeSession?.messages || []),
              userMsg,
              assistantMsg,
            ],
          };

          const existsInList = state.sessions.some(
            (s) => s.id === updatedSession.id,
          );

          return {
            activeSession: updatedSession,
            sessions: existsInList
              ? state.sessions.map((s) =>
                  s.id === updatedSession.id ? updatedSession : s,
                )
              : [updatedSession, ...state.sessions],
            isSearching: false,
          };
        });

        return response.data as any;
      } catch (error: any) {
        set({ isSearching: false, error: error.message });
        throw error;
      }
    },

    clearActiveSession: () => set({ activeSession: null }),
  }),
);
