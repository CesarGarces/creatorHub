import { create } from "zustand";
import api from "@/lib/api";

interface CreditsState {
  balance: number;
  isLoading: boolean;

  fetchBalance: () => Promise<void>;
  setBalance: (balance: number) => void;
}

export const useCreditsStore = create<CreditsState>()((set) => ({
  balance: 0,
  isLoading: false,

  fetchBalance: async () => {
    set({ isLoading: true });
    try {
      const res = await api.get<{ balance: number }>("/credits/balance");
      set({ balance: res.balance });
    } finally {
      set({ isLoading: false });
    }
  },

  setBalance: (balance) => set({ balance }),
}));
