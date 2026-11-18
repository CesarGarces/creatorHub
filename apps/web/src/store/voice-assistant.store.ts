import { create } from "zustand";
import {
  FREE_VOICE_LIMIT_CODE,
  type AssistantActionRecord,
  type TTSLanguage,
  type VoiceAllowance,
  type VoiceAssistantEvent,
  type VoiceAssistantMessage,
  type VoiceConversationDetail,
  type VoiceConversationSummary,
} from "@creator-hub/shared-types";
import api from "@/lib/api";
import type { ModelSettings } from "@/lib/model-settings";
import {
  readPreferences,
  writePreferences,
  DEFAULT_PREFERENCES,
} from "@/lib/voice-assistant/preferences";
import {
  AssistantStreamError,
  streamAssistantReply,
  type DoneEvent,
} from "@/lib/voice-assistant/stream";
import { useCreditsStore } from "./credits.store";

/**
 * Robotina's conversations (tool page and dashboard widget share them: a
 * talk started on the widget continues on the page).
 */

export interface RobotinaMessage {
  /** Server id once saved; `local-…` while the reply streams. */
  id: string;
  role: "user" | "assistant";
  content: string;
  spoken: boolean;
  language?: TTSLanguage;
  audioMs: number;
  credits: number;
  interrupted: boolean;
  /** The reply is still arriving. */
  streaming?: boolean;
  /**
   * Robotina's voice stopped for this reply (the rest came as text):
   * `true` on a failure, `"credits"` when the balance ran out,
   * `"free-limit"` when the Free plan's minutes did.
   */
  voiceFailed?: boolean | "credits" | "free-limit";
  /** Failed reply: localized by the UI. */
  error?: string;
  /** What she did during the reply (e.g. a calendar event), in order. */
  actions?: AssistantActionRecord[];
}

export interface SendOptions {
  spoken: boolean;
  languageHint?: TTSLanguage;
  signal?: AbortSignal;
  /** Every event of the reply (the hook plays the `audio` ones). */
  onEvent?: (event: VoiceAssistantEvent) => void;
}

interface VoiceAssistantState {
  conversations: VoiceConversationSummary[];
  isLoadingConversations: boolean;
  activeConversationId: string | null;
  messages: RobotinaMessage[];
  isLoadingConversation: boolean;
  isReplying: boolean;
  settings: ModelSettings;
  handsFree: boolean;
  preferencesLoaded: boolean;
  /**
   * Free plan minutes with Robotina (Admin → Voice); null until loaded or
   * when there is nothing to limit.
   */
  allowance: VoiceAllowance | null;

  loadPreferences: () => void;
  updateSettings: (partial: Partial<ModelSettings>) => void;
  setHandsFree: (value: boolean) => void;
  fetchConversations: () => Promise<void>;
  openConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  deleteConversation: (id: string) => Promise<void>;
  /** Reads what the user has left of the Free plan's minutes. */
  loadAllowance: () => Promise<void>;
  /** The server said the minutes are used up (reply or voice refused). */
  markAllowanceExhausted: () => void;
  /** Sends a message; resolves with the reply (null if interrupted). */
  sendMessage: (
    content: string,
    options: SendOptions,
  ) => Promise<DoneEvent | null>;
}

let localId = 0;
const nextLocalId = (role: string) => `local-${role}-${++localId}`;

export function toRobotinaMessage(m: VoiceAssistantMessage): RobotinaMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    spoken: m.spoken,
    language: m.language,
    audioMs: m.audioMs,
    credits: m.creditsCharged,
    interrupted: m.interrupted,
    ...(m.actions?.length ? { actions: m.actions } : {}),
  };
}

/** The browser's IANA time zone (actions' dates and times), if known. */
export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function isAllowance(value: unknown): value is VoiceAllowance {
  const v = value as Partial<VoiceAllowance> | null;
  return (
    !!v &&
    typeof v.limited === "boolean" &&
    typeof v.exhausted === "boolean" &&
    typeof v.usedSeconds === "number"
  );
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : (error as { name?: string })?.name === "AbortError";
}

export const useVoiceAssistantStore = create<VoiceAssistantState>()((
  set,
  get,
) => {
  const patchMessage = (id: string, patch: Partial<RobotinaMessage>) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));

  const savePreferences = () => {
    const { settings, handsFree } = get();
    writePreferences({ settings, handsFree });
  };

  return {
    conversations: [],
    isLoadingConversations: false,
    activeConversationId: null,
    messages: [],
    isLoadingConversation: false,
    isReplying: false,
    settings: DEFAULT_PREFERENCES.settings,
    handsFree: DEFAULT_PREFERENCES.handsFree,
    preferencesLoaded: false,
    allowance: null,

    loadAllowance: async () => {
      try {
        const allowance = await api.get<VoiceAllowance>("/voice/allowance");
        if (isAllowance(allowance)) set({ allowance });
      } catch {
        // Optional: the server still enforces the limit.
      }
    },

    markAllowanceExhausted: () => {
      set((state) => ({
        allowance: {
          ...(state.allowance ?? {
            limited: true,
            period: "monthly",
            limitSeconds: null,
            usedSeconds: 0,
            resetsAt: null,
          }),
          limited: true,
          remainingSeconds: 0,
          exhausted: true,
        },
      }));
      // The details (total minutes, when they come back) from the server.
      void get().loadAllowance();
    },

    loadPreferences: () => {
      if (get().preferencesLoaded) return;
      const prefs = readPreferences();
      set({ ...prefs, preferencesLoaded: true });
    },

    updateSettings: (partial) => {
      set((state) => ({ settings: { ...state.settings, ...partial } }));
      savePreferences();
    },

    setHandsFree: (value) => {
      set({ handsFree: value });
      savePreferences();
    },

    fetchConversations: async () => {
      set({ isLoadingConversations: true });
      try {
        const res = await api.get<{ data: VoiceConversationSummary[] }>(
          "/tools/voice-assistant/conversations",
          { params: { limit: "50" } },
        );
        const fetched = Array.isArray(res?.data) ? res.data : [];
        // A conversation started while the list was loading stays.
        set((state) => {
          const known = new Set(fetched.map((c) => c.id));
          const local = state.conversations.filter(
            (c) => !known.has(c.id) && c.id === state.activeConversationId,
          );
          return { conversations: [...local, ...fetched] };
        });
      } catch {
        // History is optional: the conversation itself still works.
      } finally {
        set({ isLoadingConversations: false });
      }
    },

    openConversation: async (id) => {
      if (get().isReplying) return;
      set({
        activeConversationId: id,
        messages: [],
        isLoadingConversation: true,
      });
      try {
        const res = await api.get<{ data: VoiceConversationDetail }>(
          `/tools/voice-assistant/conversations/${encodeURIComponent(id)}`,
        );
        if (get().activeConversationId !== id) return;
        set({ messages: res.data.messages.map(toRobotinaMessage) });
      } catch {
        if (get().activeConversationId === id) {
          set({ activeConversationId: null, messages: [] });
        }
      } finally {
        set({ isLoadingConversation: false });
      }
    },

    newConversation: () => {
      if (get().isReplying) return;
      set({ activeConversationId: null, messages: [] });
    },

    deleteConversation: async (id) => {
      await api.delete(
        `/tools/voice-assistant/conversations/${encodeURIComponent(id)}`,
      );
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        ...(state.activeConversationId === id
          ? { activeConversationId: null, messages: [] }
          : {}),
      }));
    },

    sendMessage: async (content, options) => {
      const text = content.trim();
      if (!text || get().isReplying) return null;
      const { settings, activeConversationId } = get();

      let userId = nextLocalId("user");
      let assistantId = nextLocalId("assistant");
      set((state) => ({
        isReplying: true,
        messages: [
          ...state.messages,
          {
            id: userId,
            role: "user",
            content: text,
            spoken: options.spoken,
            audioMs: 0,
            credits: 0,
            interrupted: false,
          },
          {
            id: assistantId,
            role: "assistant",
            content: "",
            spoken: false,
            audioMs: 0,
            credits: 0,
            interrupted: false,
            streaming: true,
          },
        ],
      }));

      const onEvent = (event: VoiceAssistantEvent) => {
        switch (event.type) {
          case "start": {
            patchMessage(userId, {
              id: event.userMessageId,
              language: event.language,
            });
            userId = event.userMessageId;
            patchMessage(assistantId, { language: event.language });
            const now = new Date().toISOString();
            set((state) => ({
              activeConversationId: event.conversationId,
              conversations: state.conversations.some(
                (c) => c.id === event.conversationId,
              )
                ? state.conversations
                : [
                    {
                      id: event.conversationId,
                      title: event.title,
                      language: event.language,
                      lastMessage: text,
                      messageCount: 1,
                      createdAt: now,
                      updatedAt: now,
                    },
                    ...state.conversations,
                  ],
            }));
            break;
          }
          case "delta":
            set((state) => ({
              messages: state.messages.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + event.content }
                  : m,
              ),
            }));
            break;
          case "audio":
            patchMessage(assistantId, { spoken: true });
            break;
          case "audio_error":
            patchMessage(assistantId, { voiceFailed: event.reason ?? true });
            break;
          case "action": {
            const { type: _type, ...record } = event;
            set((state) => ({
              messages: state.messages.map((m) => {
                if (m.id !== assistantId) return m;
                const actions = m.actions ?? [];
                return {
                  ...m,
                  actions: actions.some((a) => a.id === record.id)
                    ? actions.map((a) => (a.id === record.id ? record : a))
                    : [...actions, record],
                };
              }),
            }));
            break;
          }
          case "done": {
            patchMessage(assistantId, {
              id: event.messageId,
              content: event.content,
              language: event.language,
              audioMs: event.audioMs,
              spoken: event.audioMs > 0,
              credits: event.credits,
              streaming: false,
            });
            assistantId = event.messageId;
            useCreditsStore.getState().setBalance(event.balance);
            // Her voice counted towards a Free user's minutes.
            if (get().allowance?.limited) void get().loadAllowance();
            const conversationId = get().activeConversationId;
            set((state) => ({
              conversations: [
                ...state.conversations
                  .filter((c) => c.id === conversationId)
                  .map((c) => ({
                    ...c,
                    language: event.language,
                    lastMessage: event.content,
                    messageCount: c.messageCount + 2,
                    updatedAt: new Date().toISOString(),
                  })),
                ...state.conversations.filter((c) => c.id !== conversationId),
              ],
            }));
            break;
          }
        }
        options.onEvent?.(event);
      };

      try {
        return await streamAssistantReply(
          {
            conversationId: activeConversationId ?? undefined,
            content: text,
            spoken: options.spoken,
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens,
            languageHint: options.languageHint,
            timeZone: browserTimeZone(),
          },
          onEvent,
          options.signal,
        );
      } catch (error) {
        const current = get().messages.find((m) => m.id === assistantId);
        if (isAbort(error) || options.signal?.aborted) {
          // Interrupted: keep what was already said.
          if (current && !current.content) {
            set((state) => ({
              messages: state.messages.filter((m) => m.id !== assistantId),
            }));
          } else {
            patchMessage(assistantId, {
              streaming: false,
              interrupted: true,
            });
          }
          return null;
        }
        if (
          error instanceof AssistantStreamError &&
          error.code === FREE_VOICE_LIMIT_CODE
        ) {
          // Nothing was saved: the upgrade invitation replaces the turn.
          set((state) => ({
            messages: state.messages.filter(
              (m) => m.id !== userId && m.id !== assistantId,
            ),
          }));
          get().markAllowanceExhausted();
          throw error;
        }
        patchMessage(assistantId, {
          streaming: false,
          error: (error as Error)?.message || "error",
        });
        // A failed first message undoes the new conversation on the
        // server: forget it here too, the next message starts a new one.
        if (!activeConversationId) {
          const created = get().activeConversationId;
          set((state) => ({
            activeConversationId: null,
            conversations: state.conversations.filter((c) => c.id !== created),
          }));
        }
        throw error;
      } finally {
        set({ isReplying: false });
      }
    },
  };
});
