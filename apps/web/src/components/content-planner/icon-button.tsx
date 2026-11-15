import { cn } from "@creator-hub/ui";

/** Square icon button sized to sit next to a form field. */
export function IconButton({
  label,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:border-primary/60 hover:text-text disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
