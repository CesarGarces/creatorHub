import { create } from "zustand";
import api from "@/lib/api";

interface CreditsState {
  balance: number;
  freeCredits: number;
  purchasedCredits: number;
  plan: string;
  isLoading: boolean;
  error: string | null;

  fetchBalance: () => Promise<void>;
  setBalance: (balance: number) => void;
}

export const useCreditsStore = create<CreditsState>()((set) => ({
  balance: 0,
  freeCredits: 0,
  purchasedCredits: 0,
  plan: "FREE",
  isLoading: false,
  error: null,

  fetchBalance: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get<{
        balance: number;
        freeCredits: number;
        purchasedCredits: number;
        plan: string;
      }>("/credits/balance");
      set({
        balance: res.balance,
        freeCredits: res.freeCredits,
        purchasedCredits: res.purchasedCredits,
        plan: res.plan,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch credit balance";
      set({ error: message });
      console.error("[CreditsStore] fetchBalance failed:", message);
    } finally {
      set({ isLoading: false });
    }
  },

  setBalance: (balance) => set({ balance }),
}));
