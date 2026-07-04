"use client";

import { Star } from "lucide-react";
import { cn } from "../lib/utils";

interface ToolCardProps {
  name: string;
  description: string;
  icon?: string;
  credits: number;
  status?: string;
  category?: string;
  isPremium?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onClick?: () => void;
}

export function ToolCard({
  name,
  description,
  icon,
  credits,
  status,
  category,
  isPremium,
  isFavorite = false,
  onToggleFavorite,
  onClick,
}: ToolCardProps) {
  const isInactive = status === "inactive";

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border bg-surface p-5 transition-all duration-200 cursor-pointer",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        isInactive &&
          "opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none hover:border-border",
      )}
      onClick={isInactive ? undefined : onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-light text-lg transition-colors duration-200 group-hover:bg-primary/20">
            {icon || "🔧"}
          </div>
          <div>
            <h3 className="font-semibold text-text">{name}</h3>
            <p className="text-sm text-text-muted line-clamp-1">
              {description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {category && (
            <span className="rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs text-text-muted border border-border-subtle">
              {category}
            </span>
          )}
          {onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              className={cn(
                "p-1.5 rounded-lg transition-all duration-200",
                "hover:bg-surface-elevated",
                isFavorite
                  ? "text-warning"
                  : "text-text-dim hover:text-warning/70",
              )}
              aria-label={
                isFavorite ? "Remove from favorites" : "Add to favorites"
              }
            >
              {isFavorite ? (
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <Star size={16} />
              )}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {isPremium && (
          <span className="rounded-full bg-warning-light px-2 py-0.5 text-xs text-warning font-medium">
            Premium
          </span>
        )}
        {status && status !== "active" && (
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-text-muted">
            {status}
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </div>
  );
}
