"use client";

import { useEffect } from "react";
import { Heart } from "lucide-react";
import { useAssetLikesStore } from "@/store/asset-likes.store";

interface AssetLikeButtonProps {
  assetId: string;
  initialLikeCount: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  className?: string;
}

export function AssetLikeButton({
  assetId,
  initialLikeCount,
  size = "md",
  showCount = true,
  className = "",
}: AssetLikeButtonProps) {
  const { likesMap, fetchLikeStatus, toggleLike } = useAssetLikesStore();

  const likeState = likesMap[assetId];
  const isLiked = likeState?.liked ?? false;
  const likeCount = likeState?.likeCount ?? initialLikeCount;

  // Fetch like status on mount
  useEffect(() => {
    fetchLikeStatus(assetId);
  }, [assetId, fetchLikeStatus]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike(assetId);
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-1.5",
    lg: "px-4 py-2 text-base gap-2",
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`
        flex items-center justify-center rounded-xl font-medium transition-all duration-200
        ${
          isLiked
            ? "bg-red-500/10 text-red-500 hover:bg-red-500/20"
            : "bg-surface-elevated text-text-muted hover:bg-surface-elevated/80 hover:text-text"
        }
        ${sizeClasses[size]}
        ${className}
      `}
      aria-label={isLiked ? "Unlike this asset" : "Like this asset"}
    >
      <Heart
        size={iconSizes[size]}
        className={`transition-all duration-200 ${
          isLiked ? "fill-current scale-110" : ""
        }`}
      />
      {showCount && <span>{likeCount}</span>}
    </button>
  );
}
