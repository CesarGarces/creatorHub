"use client";

import { Star } from "lucide-react";
import { cn } from "../lib/utils";

interface ToolCardProps {
  name: string;
  description: string;
  icon?: string;
  credits?: number;
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
        "group relative rounded-xl border border-border bg-surface overflow-hidden",
        "transition-all duration-200 ease-out",
        "hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5",
        "active:scale-[0.98] active:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        isInactive &&
          "opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none hover:border-border hover:scale-100 active:scale-100",
        !isInactive && "cursor-pointer",
      )}
      onClick={isInactive ? undefined : onClick}
      role={!isInactive ? "button" : undefined}
      tabIndex={!isInactive ? 0 : undefined}
      onKeyDown={
        !isInactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-lg transition-all duration-200 group-hover:from-primary/25 group-hover:to-primary/10 group-hover:scale-105">
              {icon || "🔧"}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-text truncate">
                {name}
              </h3>
              <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {category && (
              <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-text-muted border border-border-subtle uppercase tracking-wider">
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
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-150",
                  "hover:bg-surface-elevated active:scale-90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
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

        <div className="mt-4 flex items-center gap-2">
          {isPremium && (
            <span className="inline-flex items-center rounded-md bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
              Premium
            </span>
          )}
          {status && status !== "active" && (
            <span className="inline-flex items-center rounded-md bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-text-muted capitalize">
              {status}
            </span>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </div>
  );
}
