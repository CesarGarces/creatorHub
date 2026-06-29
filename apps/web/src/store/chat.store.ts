import { create } from "zustand";
import api from "@/lib/api";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: Array<{
    toolId: string;
    toolName: string;
    params: Record<string, unknown>;
  }>;
  tokensUsed?: number;
  createdAt: string;
}

interface ChatSession {
  id: string;
  title?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  reasoning: number;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface ChatSettings {
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  reasoning: number;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  isWidgetOpen: boolean;
  settings: ChatSettings;
  availableTools: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    creditsPerUse: number;
    route?: string;
  }>;

  openWidget: () => void;
  closeWidget: () => void;
  fetchSessions: () => Promise<void>;
  createSession: (title?: string) => Promise<string>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<ChatSettings>) => Promise<void>;
  fetchTools: () => Promise<void>;
  clearActiveSession: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  isStreaming: false,
  isWidgetOpen: false,
  settings: {
    defaultModel: "zai-org/GLM-5.2",
    temperature: 0.7,
    maxTokens: 8000,
    reasoning: 0.7,
  },
  availableTools: [],

  openWidget: () => set({ isWidgetOpen: true }),
  closeWidget: () => set({ isWidgetOpen: false }),

  fetchSessions: async () => {
    try {
      const sessions = await api.get<ChatSession[]>("/chat/sessions");
      set({ sessions });
    } catch (error) {
      console.error("Failed to fetch chat sessions:", error);
    }
  },

  createSession: async (title?: string) => {
    const { settings } = get();
    const session = await api.post<ChatSession>("/chat/sessions", {
      title,
      model: settings.defaultModel,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      reasoning: settings.reasoning,
    });

    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id,
      messages: [],
    }));

    return session.id;
  },

  selectSession: async (sessionId: string) => {
    try {
      const session = await api.get<ChatSession & { messages: ChatMessage[] }>(
        `/chat/sessions/${sessionId}`,
      );
      set({
        activeSessionId: sessionId,
        messages: session.messages || [],
      });
    } catch (error) {
      console.error("Failed to load session:", error);
    }
  },

  deleteSession: async (sessionId: string) => {
    await api.delete(`/chat/sessions/${sessionId}`);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      activeSessionId:
        state.activeSessionId === sessionId ? null : state.activeSessionId,
      messages: state.activeSessionId === sessionId ? [] : state.messages,
    }));
  },

  sendMessage: async (content: string) => {
    const { activeSessionId, messages } = get();
    let sessionId = activeSessionId;

    if (!sessionId) {
      sessionId = await get().createSession();
    }

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
    }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/chat/sessions/${sessionId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${document.cookie.match(/access_token=([^;]+)/)?.[1] || ""}`,
          },
          credentials: "include",
          body: JSON.stringify({ content }),
        },
      );

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.type === "content" && data.content) {
              assistantContent += data.content;
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: assistantContent }
                    : m,
                ),
              }));
            } else if (data.type === "done") {
              set((state) => ({
                messages: state.messages.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: assistantContent || data.content }
                    : m,
                ),
                isStreaming: false,
              }));

              const { useCreditsStore } = await import("@/store/credits.store");
              useCreditsStore.getState().fetchBalance();
            } else if (data.type === "error") {
              set({ isStreaming: false });
              throw new Error(data.error);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      if (!assistantContent) {
        set({ isStreaming: false });
      }

      get().fetchSessions();
    } catch (error) {
      console.error("Stream error:", error);
      set((state) => ({
        messages: [
          ...state.messages,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `Error: ${(error as Error).message}`,
            createdAt: new Date().toISOString(),
          },
        ],
        isStreaming: false,
      }));
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await api.get<ChatSettings>("/chat/settings");
      set({ settings });
    } catch (error) {
      console.error("Failed to fetch chat settings:", error);
    }
  },

  updateSettings: async (newSettings: Partial<ChatSettings>) => {
    try {
      const settings = await api.put<ChatSettings>(
        "/chat/settings",
        newSettings,
      );
      set({ settings });
    } catch (error) {
      console.error("Failed to update chat settings:", error);
    }
  },

  fetchTools: async () => {
    try {
      const tools = await api.get<
        Array<{
          id: string;
          name: string;
          description: string;
          category: string;
          creditsPerUse: number;
          route?: string;
        }>
      >("/chat/tools");
      set({ availableTools: tools });
    } catch (error) {
      console.error("Failed to fetch chat tools:", error);
    }
  },

  clearActiveSession: () => {
    set({ activeSessionId: null, messages: [] });
  },
}));
