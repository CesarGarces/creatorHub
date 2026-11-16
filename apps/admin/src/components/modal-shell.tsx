"use client";

import { cn } from "@creator-hub/ui";

const SIZES = {
  md: "max-w-md",
  lg: "max-w-lg",
  "5xl": "max-w-5xl",
} as const;

interface ModalShellProps {
  /** id of the element that titles the dialog. */
  labelledBy: string;
  size?: keyof typeof SIZES;
  className?: string;
  children: React.ReactNode;
}

/**
 * Overlay + panel of the admin's inline modals (layout only — open/close
 * state stays with each page). Mobile-first: a small margin on phones and
 * never taller than the visible viewport, so forms stay reachable while the
 * on-screen keyboard is open; the panel scrolls instead.
 */
export function ModalShell({
  labelledBy,
  size = "md",
  className,
  children,
}: ModalShellProps) {
  return (
    <div className="fixed inset-x-0 top-[var(--app-vv-top,0px)] z-50 flex h-[var(--app-vvh,100dvh)] items-center justify-center bg-black/50 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          "max-h-full w-full overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-5 sm:p-6",
          SIZES[size],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
