import { create } from "zustand";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationState {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  fetchNotifications: (options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  deleteAll: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  hydrate: () => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  total: 0,
  unreadCount: 0,
  isLoading: false,
  isHydrated: false,

  fetchNotifications: async (options = {}) => {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    set({ isLoading: true });

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        unreadOnly: unreadOnly.toString(),
      });

      const response = await fetch(`${API_URL}/notifications?${params}`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();

      set({
        notifications: data.notifications,
        total: data.total,
        unreadCount: data.unreadCount,
        isLoading: false,
        isHydrated: true,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch unread count");
      }

      const data = await response.json();

      set({ unreadCount: data.count });
    } catch {
      // Silently fail
    }
  },

  markAsRead: async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to mark as read");
      }

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // Silently fail
    }
  },

  markAllAsRead: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to mark all as read");
      }

      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch {
      // Silently fail
    }
  },

  deleteNotification: async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }

      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        const wasUnread = notification && !notification.readAt;

        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          total: Math.max(0, state.total - 1),
          unreadCount: wasUnread
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch {
      // Silently fail
    }
  },

  deleteAll: async () => {
    try {
      const response = await fetch(`${API_URL}/notifications`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete all notifications");
      }

      set({
        notifications: [],
        total: 0,
        unreadCount: 0,
      });
    } catch {
      // Silently fail
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      total: state.total + 1,
      unreadCount: state.unreadCount + 1,
    }));
  },

  hydrate: () => {
    set({ isHydrated: true });
  },
}));

/**
 * Get access token from cookies
 */
function getAccessToken(): string {
  if (typeof document === "undefined") return "";

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "access_token" && value) {
      return decodeURIComponent(value);
    }
  }
  return "";
}
