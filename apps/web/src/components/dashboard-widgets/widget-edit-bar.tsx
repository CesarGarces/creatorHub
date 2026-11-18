"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Button, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";

/** Where widgets are added (Settings → Dashboard). */
export const ADD_WIDGETS_HREF = "/settings#dashboard";

interface WidgetEditBarProps {
  onDone: () => void;
  className?: string;
}

/**
 * Shown while the dashboard is being rearranged. Sticks under the top bar,
 * so "Done" stays within reach of the thumb on long dashboards.
 */
export function WidgetEditBar({ onDone, className }: WidgetEditBarProps) {
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "sticky top-14 z-30 -mx-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-bg/90 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6",
        "animate-in fade-in slide-in-from-top-2 duration-200",
        className,
      )}
    >
      <p className="min-w-0 flex-1 basis-48 text-sm text-text-muted">
        {t("dashboard.layout.editing")}
      </p>
      {/* Right-aligned when it wraps (phones): "Done" under the thumb. */}
      <div className="ml-auto flex items-center gap-2">
        <Link
          href={ADD_WIDGETS_HREF}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text transition-colors hover:bg-surface-elevated pointer-coarse:h-11"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("dashboard.layout.addWidgets")}
        </Link>
        <Button
          variant="primary"
          size="sm"
          onClick={onDone}
          className="h-9 gap-1.5 rounded-lg text-sm pointer-coarse:h-11"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {t("dashboard.layout.done")}
        </Button>
      </div>
    </div>
  );
}
