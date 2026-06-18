import { cn } from "../lib/utils";

interface CreditDisplayProps {
  balance: number;
  className?: string;
  size?: "sm" | "md";
}

export function CreditDisplay({
  balance,
  className,
  size = "md",
}: CreditDisplayProps) {
  const isLow = balance < 100;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full font-medium transition-colors",
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
      <span>{balance.toLocaleString()} credits</span>
    </div>
  );
}
