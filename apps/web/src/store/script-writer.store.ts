import { create } from "zustand";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/cookie";
import { type ModelSettings } from "@/components/chat/model-settings-panel";

export interface ScriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  scriptId?: string;
  isStreaming?: boolean;
  duration?: number;
  wordCount?: number;
  thumbnailPrompt?: string;
}

export interface GeneratedScript {
  id: string;
  title: string | null;
  topic: string;
  content: string;
  platform: string;
  tone: string | null;
  hookType: string | null;
  estimatedDuration: number | null;
  wordCount: number | null;
  thumbnailPrompt: string | null;
  status: string;
  createdAt: string;
}

export interface ScriptConfig {
  platform: string;
  tone: string;
  hookType: string;
  targetDuration: number;
}

interface ScriptWriterState {
  messages: ScriptMessage[];
  scripts: GeneratedScript[];
  activeScript: GeneratedScript | null;
  isGenerating: boolean;
  config: ScriptConfig;
  showSidebar: boolean;
  scriptsLoaded: boolean;

  sendMessage: (text: string, settings: ModelSettings) => Promise<void>;
  fetchScripts: () => Promise<void>;
  selectScript: (scriptId: string) => Promise<void>;
  deleteScript: (scriptId: string) => Promise<void>;
  setConfig: (config: Partial<ScriptConfig>) => void;
  toggleSidebar: () => void;
  clearChat: () => void;
}

const DEFAULT_CONFIG: ScriptConfig = {
  platform: "youtube-long",
  tone: "emotional",
  hookType: "mystery",
  targetDuration: 300,
};

export const useScriptWriterStore = create<ScriptWriterState>()((set, get) => ({
  messages: [],
  scripts: [],
  activeScript: null,
  isGenerating: false,
  config: DEFAULT_CONFIG,
  showSidebar: true,
  scriptsLoaded: false,

  sendMessage: async (text: string, settings: ModelSettings) => {
    const { config, isGenerating } = get();
    if (isGenerating || !text.trim()) return;

    const userMessage: ScriptMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const assistantMessage: ScriptMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isGenerating: true,
    }));

    try {
      const token = getAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1"}/tools/script-writer/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            topic: text,
            platform: config.platform,
            tone: config.tone,
            hookType: config.hookType,
            targetDuration: config.targetDuration,
            model: settings.model || undefined,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            useStyle: true,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed (${response.status})`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const rawData = trimmed.slice(6);
          try {
            const event = JSON.parse(rawData);

            switch (event.type) {
              case "content":
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + event.content }
                      : msg,
                  ),
                }));
                break;

              case "done":
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          isStreaming: false,
                          scriptId: event.scriptId,
                          duration: event.estimatedDuration,
                          wordCount: event.wordCount,
                          thumbnailPrompt: event.thumbnailPrompt,
                        }
                      : msg,
                  ),
                  isGenerating: false,
                }));
                get().fetchScripts();
                break;

              case "error":
                set((state) => ({
                  messages: state.messages.map((msg) =>
                    msg.id === assistantMessage.id
                      ? {
                          ...msg,
                          content: `Error: ${event.error}`,
                          isStreaming: false,
                        }
                      : msg,
                  ),
                  isGenerating: false,
                }));
                break;
            }
          } catch {
            // skip malformed JSON lines
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const event = JSON.parse(trimmed.slice(6));
            if (event.type === "content") {
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + event.content }
                    : msg,
                ),
              }));
            } else if (event.type === "done") {
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? {
                        ...msg,
                        isStreaming: false,
                        scriptId: event.scriptId,
                        duration: event.estimatedDuration,
                        wordCount: event.wordCount,
                        thumbnailPrompt: event.thumbnailPrompt,
                      }
                    : msg,
                ),
                isGenerating: false,
              }));
              get().fetchScripts();
            } else if (event.type === "error") {
              set((state) => ({
                messages: state.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? {
                        ...msg,
                        content: `Error: ${event.error}`,
                        isStreaming: false,
                      }
                    : msg,
                ),
                isGenerating: false,
              }));
            }
          } catch {
            // skip
          }
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to generate script";
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantMessage.id
            ? {
                ...msg,
                content: `Error: ${message}`,
                isStreaming: false,
              }
            : msg,
        ),
        isGenerating: false,
      }));
    }
  },

  fetchScripts: async () => {
    if (get().scriptsLoaded) return;
    try {
      const response = await api.get<{
        success: boolean;
        data: GeneratedScript[];
      }>("/tools/script-writer/scripts");
      set({ scripts: response.data, scriptsLoaded: true });
    } catch {
      // silently fail
    }
  },

  selectScript: async (scriptId: string) => {
    try {
      const response = await api.get<{
        success: boolean;
        data: GeneratedScript;
      }>(`/tools/script-writer/scripts/${scriptId}`);
      const script = response.data;
      set({
        activeScript: script,
        messages: [
          {
            id: `user-${script.id}`,
            role: "user",
            content: script.topic,
          },
          {
            id: `assistant-${script.id}`,
            role: "assistant",
            content: script.content,
            scriptId: script.id,
            duration: script.estimatedDuration ?? undefined,
            wordCount: script.wordCount ?? undefined,
            thumbnailPrompt: script.thumbnailPrompt ?? undefined,
          },
        ],
      });
    } catch {
      // silently fail
    }
  },

  deleteScript: async (scriptId: string) => {
    try {
      await api.delete(`/tools/script-writer/scripts/${scriptId}`);
      set((state) => ({
        scripts: state.scripts.filter((s) => s.id !== scriptId),
        activeScript:
          state.activeScript?.id === scriptId ? null : state.activeScript,
      }));
    } catch {
      // silently fail
    }
  },

  setConfig: (config) =>
    set((state) => ({ config: { ...state.config, ...config } })),

  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),

  clearChat: () => set({ messages: [], activeScript: null }),
}));
