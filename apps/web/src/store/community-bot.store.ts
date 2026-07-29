import { create } from "zustand";
import api from "@/lib/api";

// ─── Types (mirror the API payloads) ─────────────────────────

export interface CommunityBotConfig {
  id: string;
  userId: string;
  isEnabled: boolean;
  modelId: string;
  temperature: number;
  maxTokens: number;
  systemPromptExtra: string | null;
  useStyleProfile: boolean;
  historyLength: number;
  dailyReplyLimit: number;
  perContactCooldownSec: number;
}

export type ChannelStatus =
  | "DISCONNECTED"
  | "CONNECTING"
  | "AWAITING_QR"
  | "ACTIVE"
  | "REQUIRES_RESCAN"
  | "ERROR";

export interface CommunityChannel {
  id: string;
  type: "TELEGRAM" | "WHATSAPP" | "INSTAGRAM";
  status: ChannelStatus;
  externalIdentity: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  messageCount: number;
  lastMessageAt: string | null;
  contact: {
    externalId: string;
    username: string | null;
    displayName: string | null;
    isBlocked: boolean;
  };
  channel: { type: CommunityChannel["type"] };
  messages: Array<{
    content: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: string;
  }>;
}

export interface ConversationMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  status: string;
  skipReason: string | null;
  modelId: string | null;
  creditsUsed: number | null;
  createdAt: string;
}

export interface PlaygroundResult {
  reply: string;
  modelId: string;
  creditsUsed: number;
  balance: number;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

// ─── Store ───────────────────────────────────────────────────

interface CommunityBotState {
  config: CommunityBotConfig | null;
  channels: CommunityChannel[];
  conversations: ConversationSummary[];
  conversationsTotal: number;
  activeConversationId: string | null;
  activeMessages: ConversationMessage[];
  playgroundHistory: Array<{ input: string; result: PlaygroundResult }>;
  isLoadingConfig: boolean;
  isLoadingChannels: boolean;
  isLoadingConversations: boolean;
  isLoadingMessages: boolean;
  isSavingConfig: boolean;
  isConnecting: boolean;
  isPlaygroundLoading: boolean;
  error: string | null;

  fetchConfig: () => Promise<void>;
  updateConfig: (
    patch: Partial<Omit<CommunityBotConfig, "id" | "userId">>,
  ) => Promise<CommunityBotConfig | null>;
  fetchChannels: () => Promise<void>;
  connectTelegram: (botToken: string) => Promise<boolean>;
  disconnectChannel: (type: CommunityChannel["type"]) => Promise<void>;
  fetchConversations: (page?: number) => Promise<void>;
  openConversation: (conversationId: string) => Promise<void>;
  closeConversation: () => void;
  sendPlaygroundMessage: (message: string) => Promise<void>;
  applyChannelStatus: (update: {
    channelId: string;
    status: ChannelStatus;
    externalIdentity?: string;
    error?: string;
  }) => void;
}

export const useCommunityBotStore = create<CommunityBotState>()((set, get) => ({
  config: null,
  channels: [],
  conversations: [],
  conversationsTotal: 0,
  activeConversationId: null,
  activeMessages: [],
  playgroundHistory: [],
  isLoadingConfig: false,
  isLoadingChannels: false,
  isLoadingConversations: false,
  isLoadingMessages: false,
  isSavingConfig: false,
  isConnecting: false,
  isPlaygroundLoading: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoadingConfig: true, error: null });
    try {
      const res = await api.get<ApiEnvelope<CommunityBotConfig>>(
        "/community-bot/config",
      );
      set({ config: res.data });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load config",
      });
    } finally {
      set({ isLoadingConfig: false });
    }
  },

  updateConfig: async (patch) => {
    set({ isSavingConfig: true, error: null });
    try {
      const res = await api.put<ApiEnvelope<CommunityBotConfig>>(
        "/community-bot/config",
        patch,
      );
      set({ config: res.data });
      return res.data;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to save config",
      });
      return null;
    } finally {
      set({ isSavingConfig: false });
    }
  },

  fetchChannels: async () => {
    set({ isLoadingChannels: true, error: null });
    try {
      const res = await api.get<ApiEnvelope<CommunityChannel[]>>(
        "/community-bot/channels",
      );
      set({ channels: res.data });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load channels",
      });
    } finally {
      set({ isLoadingChannels: false });
    }
  },

  connectTelegram: async (botToken) => {
    set({ isConnecting: true, error: null });
    try {
      await api.post<ApiEnvelope<CommunityChannel>>(
        "/community-bot/channels/telegram/connect",
        { botToken },
      );
      // The worker confirms asynchronously via WebSocket; fetch to show
      // the CONNECTING state immediately.
      await get().fetchChannels();
      return true;
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to connect Telegram",
      });
      return false;
    } finally {
      set({ isConnecting: false });
    }
  },

  disconnectChannel: async (type) => {
    set({ error: null });
    try {
      await api.delete<ApiEnvelope<CommunityChannel>>(
        `/community-bot/channels/${type.toLowerCase()}/disconnect`,
      );
      await get().fetchChannels();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to disconnect",
      });
    }
  },

  fetchConversations: async (page = 1) => {
    set({ isLoadingConversations: true, error: null });
    try {
      const res = await api.get<Paginated<ConversationSummary>>(
        "/community-bot/conversations",
        { params: { page: String(page), limit: "20" } },
      );
      set({ conversations: res.data, conversationsTotal: res.meta.total });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to load conversations",
      });
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  openConversation: async (conversationId) => {
    set({
      activeConversationId: conversationId,
      isLoadingMessages: true,
      error: null,
    });
    try {
      const res = await api.get<Paginated<ConversationMessage>>(
        `/community-bot/conversations/${conversationId}/messages`,
        { params: { page: "1", limit: "50" } },
      );
      set({ activeMessages: res.data });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load messages",
      });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  closeConversation: () =>
    set({ activeConversationId: null, activeMessages: [] }),

  sendPlaygroundMessage: async (message) => {
    set({ isPlaygroundLoading: true, error: null });
    try {
      const res = await api.post<ApiEnvelope<PlaygroundResult>>(
        "/community-bot/playground",
        { message },
      );
      set({
        playgroundHistory: [
          { input: message, result: res.data },
          ...get().playgroundHistory,
        ],
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Playground failed",
      });
    } finally {
      set({ isPlaygroundLoading: false });
    }
  },

  applyChannelStatus: (update) =>
    set({
      channels: get().channels.map((channel) =>
        channel.id === update.channelId
          ? {
              ...channel,
              status: update.status,
              externalIdentity:
                update.externalIdentity ?? channel.externalIdentity,
              lastError: update.error ?? null,
              lastConnectedAt:
                update.status === "ACTIVE"
                  ? new Date().toISOString()
                  : channel.lastConnectedAt,
            }
          : channel,
      ),
    }),
}));
