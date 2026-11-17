"use client";

import { HardDrive } from "lucide-react";
import { Badge, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";

export interface HeavyFilesNoteProps {
  /** Highlighted after the user picked a file over the 250 MB limit. */
  emphasized?: boolean;
  className?: string;
}

/**
 * Roadmap note: heavy camera files (up to 10 GB) are coming in a future
 * release. Today the clipper runs in the browser with files up to 250 MB.
 */
export function HeavyFilesNote({
  emphasized = false,
  className,
}: HeavyFilesNoteProps) {
  const { t } = useI18n();
  return (
    <aside
      aria-label={t("videoClipper.roadmap.title")}
      data-testid="heavy-files-note"
      data-emphasized={emphasized || undefined}
      className={cn(
        "flex gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left",
        emphasized
          ? "border-warning/60 bg-warning-light"
          : "border-border bg-surface-elevated/50",
        className,
      )}
    >
      <HardDrive
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          emphasized ? "text-warning" : "text-text-dim",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
          {t("videoClipper.roadmap.title")}
          <Badge variant="warning">{t("videoClipper.roadmap.badge")}</Badge>
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
          {t("videoClipper.roadmap.description")}
        </p>
      </div>
    </aside>
  );
}
