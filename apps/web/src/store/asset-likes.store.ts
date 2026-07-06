import { create } from "zustand";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

interface AssetLikesState {
  // Map of assetId -> { liked: boolean, likeCount: number }
  likesMap: Record<string, { liked: boolean; likeCount: number }>;
  isLoading: boolean;

  // Actions
  fetchLikeStatus: (assetId: string) => Promise<void>;
  toggleLike: (assetId: string) => Promise<void>;
  isLiked: (assetId: string) => boolean;
  getLikeCount: (assetId: string) => number;
}

export const useAssetLikesStore = create<AssetLikesState>()((set, get) => ({
  likesMap: {},
  isLoading: false,

  fetchLikeStatus: async (assetId: string) => {
    try {
      const response = await fetch(`${API_URL}/sharing/${assetId}/liked`);
      if (!response.ok) return;

      const data = await response.json();
      set((state) => ({
        likesMap: {
          ...state.likesMap,
          [assetId]: {
            liked: data.liked,
            likeCount: data.likeCount,
          },
        },
      }));
    } catch {
      // Silently fail - we'll use the initial count from props
    }
  },

  toggleLike: async (assetId: string) => {
    const { likesMap } = get();
    const current = likesMap[assetId] || { liked: false, likeCount: 0 };

    // Optimistic update
    const newLiked = !current.liked;
    const newLikeCount = newLiked
      ? current.likeCount + 1
      : Math.max(0, current.likeCount - 1);

    set((state) => ({
      likesMap: {
        ...state.likesMap,
        [assetId]: {
          liked: newLiked,
          likeCount: newLikeCount,
        },
      },
    }));

    try {
      const response = await fetch(`${API_URL}/sharing/${assetId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to toggle like");
      }

      const data = await response.json();

      // Update with actual server response
      set((state) => ({
        likesMap: {
          ...state.likesMap,
          [assetId]: {
            liked: data.liked,
            likeCount: data.likeCount,
          },
        },
      }));
    } catch {
      // Revert on error
      set((state) => ({
        likesMap: {
          ...state.likesMap,
          [assetId]: current,
        },
      }));
    }
  },

  isLiked: (assetId: string) => {
    return get().likesMap[assetId]?.liked ?? false;
  },

  getLikeCount: (assetId: string) => {
    return get().likesMap[assetId]?.likeCount ?? 0;
  },
}));
