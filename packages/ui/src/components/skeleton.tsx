import { cn } from "../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-lg bg-surface-elevated animate-shimmer bg-[length:200%_100%]",
        className
      )}
    />
  );
}
