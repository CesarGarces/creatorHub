import { forwardRef } from "react";
import { cn } from "../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "glow";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20": variant === "primary",
            "bg-surface-elevated text-text border border-border hover:bg-surface-elevated/80 hover:border-border/80": variant === "secondary",
            "bg-transparent text-text-muted hover:bg-surface-elevated hover:text-text": variant === "ghost",
            "bg-error text-white hover:bg-error/90 shadow-lg shadow-error/20": variant === "danger",
            "bg-transparent text-text-muted border border-border hover:bg-surface-elevated hover:text-text hover:border-border/80": variant === "outline",
            "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 animate-pulse-glow": variant === "glow",
          },
          {
            "h-8 px-3 text-xs rounded-md gap-1.5": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
            "h-10 w-10 p-0": size === "icon",
          },
          className
        )}
        {...props}
      >
        {isLoading ? (
          <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
