import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post<{ accessToken: string; user: User }>("/auth/login", {
            email,
            password,
          });
          localStorage.setItem("access_token", res.accessToken);
          set({ user: res.user, token: res.accessToken });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const res = await api.post<{ accessToken: string; user: User }>("/auth/register", {
            email,
            password,
            name,
          });
          localStorage.setItem("access_token", res.accessToken);
          set({ user: res.user, token: res.accessToken });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({ user: null, token: null });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
