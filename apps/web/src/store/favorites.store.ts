import { create } from "zustand";
import api from "@/lib/api";

interface FavoritesState {
  favoriteIds: string[];
  isLoading: boolean;

  fetchFavorites: () => Promise<void>;
  toggleFavorite: (toolId: string) => Promise<void>;
  isFavorite: (toolId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()((set, get) => ({
  favoriteIds: [],
  isLoading: false,

  fetchFavorites: async () => {
    set({ isLoading: true });
    try {
      const data = await api.get<string[]>("/tools/favorites");
      set({ favoriteIds: data });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleFavorite: async (toolId: string) => {
    const { favoriteIds } = get();
    const isFav = favoriteIds?.includes(toolId) ?? false;

    // Optimistic update
    set({
      favoriteIds: isFav
        ? (favoriteIds || []).filter((id) => id !== toolId)
        : [...(favoriteIds || []), toolId],
    });

    try {
      await api.post(`/tools/favorites/${toolId}/toggle`);
    } catch {
      // Revert on error
      set({
        favoriteIds: isFav
          ? [...(favoriteIds || []), toolId]
          : (favoriteIds || []).filter((id) => id !== toolId),
      });
    }
  },

  isFavorite: (toolId: string) => {
    return get().favoriteIds?.includes(toolId) ?? false;
  },
}));
