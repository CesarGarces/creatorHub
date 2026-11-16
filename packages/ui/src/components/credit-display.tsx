"use client";

import { cn } from "../lib/utils";
import { useUiLabels } from "../lib/labels";

interface CreditDisplayProps {
  balance: number;
  className?: string;
  size?: "sm" | "md";
  /**
   * Below `sm`, show the short form ("1,500 cr") to save room in crowded
   * headers. Screen readers still get the full text.
   */
  compactOnMobile?: boolean;
}

export function CreditDisplay({
  balance,
  className,
  size = "md",
  compactOnMobile = false,
}: CreditDisplayProps) {
  const labels = useUiLabels();
  const isLow = balance < 100;

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full font-medium transition-colors",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-1.5 text-sm",
        isLow
          ? "bg-error-light text-error"
          : balance < 500
            ? "bg-warning-light text-warning"
            : "bg-secondary-light text-secondary",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full bg-current/20",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
        )}
      />
      <span className={cn(compactOnMobile && "max-sm:sr-only")}>
        {labels.formatCredits(balance)}
      </span>
      {compactOnMobile && (
        <span aria-hidden="true" className="whitespace-nowrap sm:hidden">
          {labels.formatCreditsShort(balance)}
        </span>
      )}
    </div>
  );
}
