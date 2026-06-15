import { create } from "zustand";
import api from "@/lib/api";
import {
  setAccessToken,
  getAccessToken,
  removeAccessToken,
  setStoredUser,
  getStoredUser,
  removeStoredUser,
} from "@/lib/cookie";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  hydrate: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return;
    const token = getAccessToken();
    const user = getStoredUser();
    set({ token, user, isHydrated: true });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const res = await api.post<{ accessToken: string; user: User }>(
        "/auth/login",
        {
          email,
          password,
        },
      );
      setAccessToken(res.accessToken);
      setStoredUser(res.user);
      set({ user: res.user, token: res.accessToken });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, name) => {
    set({ isLoading: true });
    try {
      const res = await api.post<{ accessToken: string; user: User }>(
        "/auth/register",
        {
          email,
          password,
          name,
        },
      );
      setAccessToken(res.accessToken);
      setStoredUser(res.user);
      set({ user: res.user, token: res.accessToken });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    removeAccessToken();
    removeStoredUser();
    set({ user: null, token: null });
  },

  setUser: (user) => {
    setStoredUser(user);
    set({ user });
  },
}));
