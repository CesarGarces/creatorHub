import type { ReactNode } from "react";
import { cn } from "@creator-hub/ui";

interface WidgetHeaderProps {
  title: string;
  /** Optional link/button on the right (e.g. "View all"). */
  action?: ReactNode;
  className?: string;
}

/** Title row of a dashboard widget (the dashboard's section-title style). */
export function WidgetHeader({ title, action, className }: WidgetHeaderProps) {
  return (
    <div
      className={cn(
        "mb-4 flex min-h-5 items-center justify-between gap-3",
        // While rearranging, the title and the action slide aside for the
        // corner badges ("−" and the grip) instead of hiding under them.
        "transition-[padding] duration-200 ease-out group-data-[editing]/widget:px-7",
        className,
      )}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-dim">
        {title}
      </h2>
      {action}
    </div>
  );
}
