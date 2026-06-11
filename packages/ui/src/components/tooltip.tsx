import { cn } from "../lib/utils";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <div className="relative group/tooltip inline-flex">
      {children}
      <div
        className={cn(
          "absolute z-50 pointer-events-none rounded-md bg-surface-elevated border border-border px-2.5 py-1.5 text-xs text-text shadow-lg opacity-0 scale-95 transition-all duration-150 group-hover/tooltip:opacity-100 group-hover/tooltip:scale-100 whitespace-nowrap",
          side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
          side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
          side === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
          side === "right" && "left-full top-1/2 -translate-y-1/2 ml-2",
          className
        )}
      >
        {content}
      </div>
    </div>
  );
}
