import { cn } from "../lib/utils";

interface BadgeProps {
  variant?: "default" | "primary" | "secondary" | "accent" | "error" | "warning" | "outline" | "premium" | "free";
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = "default", size = "sm", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        {
          "bg-surface-elevated text-text-muted border border-border-subtle": variant === "default",
          "bg-primary-light text-primary": variant === "primary",
          "bg-secondary-light text-secondary": variant === "secondary",
          "bg-accent-light text-accent": variant === "accent",
          "bg-error-light text-error": variant === "error",
          "bg-warning-light text-warning": variant === "warning",
          "bg-transparent border border-border text-text-muted": variant === "outline",
          "bg-gradient-to-r from-amber-500 to-orange-500 text-white": variant === "premium",
          "bg-gradient-to-r from-emerald-500 to-teal-500 text-white": variant === "free",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
