"use client";

import { Film, Trash2 } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { formatTimestamp } from "@/lib/video-clipper/format";
import type { VideoAnalysisSummary } from "@/lib/video-clipper/types";

export interface AnalysisHistoryProps {
  items: VideoAnalysisSummary[];
  /** The analysis shown on the page. */
  activeId?: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

/** Past analyses (only the JSON result is stored — never the video). */
export function AnalysisHistory({
  items,
  activeId = null,
  onOpen,
  onDelete,
  className,
}: AnalysisHistoryProps) {
  const { t, formatRelativeTime } = useI18n();

  return (
    <section aria-labelledby="video-clipper-history" className={className}>
      <h2
        id="video-clipper-history"
        className="mb-2 text-sm font-semibold text-text"
      >
        {t("videoClipper.history.heading")}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-text-dim">
          {t("videoClipper.history.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-1 pr-1">
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                aria-label={t("videoClipper.history.open", {
                  name: item.fileName,
                })}
                aria-current={item.id === activeId ? "true" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-elevated",
                  item.id === activeId && "bg-primary/5",
                )}
              >
                <Film
                  className="h-4 w-4 shrink-0 text-text-dim"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">
                    {item.topTitle || item.fileName}
                  </span>
                  <span className="block truncate text-xs text-text-muted">
                    {item.fileName} · {formatTimestamp(item.durationSec)} ·{" "}
                    {t("videoClipper.history.clips", {
                      count: item.highlights,
                    })}{" "}
                    · {formatRelativeTime(item.createdAt)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                aria-label={t("videoClipper.history.delete", {
                  name: item.fileName,
                })}
                title={t("videoClipper.history.delete", {
                  name: item.fileName,
                })}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-dim transition-colors hover:bg-error-light hover:text-error pointer-coarse:h-11 pointer-coarse:w-11"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
