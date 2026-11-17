"use client";

import {
  Copy,
  Download,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Square,
  X,
} from "lucide-react";
import { Badge, Button, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { formatClipTime, formatSeconds } from "@/lib/video-clipper/format";
import { nudgeRange, rangeLength, sameRange } from "@/lib/video-clipper/ranges";
import type { ClipRange, VideoHighlight } from "@/lib/video-clipper/types";

export type ClipExportStatus = "idle" | "exporting" | "done" | "error";

export interface ClipExportState {
  status: ClipExportStatus;
  /** 0 → 1 */
  progress: number;
}

export interface ClipCardProps {
  clip: VideoHighlight;
  /** 1-based position in the list. */
  index: number;
  /** Current in/out points (the AI's, possibly trimmed). */
  range: ClipRange;
  durationSec: number;
  /** Longest clip for the target platform. */
  maxLength?: number;
  active?: boolean;
  previewing?: boolean;
  /** The original video is attached (preview/export possible). */
  canPlay: boolean;
  /** MediaRecorder export available in this browser. */
  exportSupported: boolean;
  exportState?: ClipExportState;
  /** Another clip is being exported. */
  exportLocked?: boolean;
  onPreview: () => void;
  onStop: () => void;
  onExport: () => void;
  onCancelExport: () => void;
  onRangeChange: (range: ClipRange) => void;
  onResetRange: () => void;
  onCopy: (text: string) => void;
}

const NUDGE_SECONDS = 1;

function scoreVariant(score: number) {
  if (score >= 80) return "secondary" as const;
  if (score >= 60) return "primary" as const;
  return "default" as const;
}

/** One detected highlight: preview, trim and export it. */
export function ClipCard({
  clip,
  index,
  range,
  durationSec,
  maxLength,
  active = false,
  previewing = false,
  canPlay,
  exportSupported,
  exportState = { status: "idle", progress: 0 },
  exportLocked = false,
  onPreview,
  onStop,
  onExport,
  onCancelExport,
  onRangeChange,
  onResetRange,
  onCopy,
}: ClipCardProps) {
  const { t } = useI18n();
  const title = clip.title || t("videoClipper.clips.untitled", { index });
  const titleId = `clip-${clip.id}-title`;
  const exporting = exportState.status === "exporting";
  const trimmed = !sameRange(range, clip);
  const limits = { durationSec, maxLength };

  const nudge = (edge: "start" | "end", delta: number) =>
    nudgeRange(range, edge, delta, limits);

  const trimButton = (
    edge: "start" | "end",
    delta: number,
    label: string,
    Icon: typeof Plus,
  ) => {
    const next = nudge(edge, delta);
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={!next || exporting}
        onClick={() => next && onRangeChange(next)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:border-primary/50 hover:text-text disabled:cursor-not-allowed disabled:text-text-dim/60 pointer-coarse:h-11 pointer-coarse:w-11"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  };

  return (
    <article
      aria-labelledby={titleId}
      data-testid={`clip-card-${clip.id}`}
      data-active={active || undefined}
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-surface p-4 transition-colors",
        active
          ? "border-primary/60 shadow-lg shadow-primary/5"
          : "border-border",
      )}
    >
      <header className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary tabular-nums">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <h3
            id={titleId}
            className="text-sm font-semibold leading-snug text-text"
          >
            {title}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-text-muted tabular-nums">
            <span>
              {formatClipTime(range.start)} – {formatClipTime(range.end)}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t("videoClipper.clips.length", {
                seconds: formatSeconds(rangeLength(range)),
              })}
            </span>
            {trimmed && (
              <Badge variant="accent">{t("videoClipper.clips.trimmed")}</Badge>
            )}
          </p>
        </div>
        <Badge
          variant={scoreVariant(clip.score)}
          className="shrink-0 tabular-nums"
        >
          {t("videoClipper.clips.score", { score: clip.score })}
        </Badge>
      </header>

      {clip.hook && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-elevated/60 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm italic text-text">
            “{clip.hook}”
          </p>
          <button
            type="button"
            onClick={() => onCopy(clip.hook)}
            aria-label={t("videoClipper.results.copyItem", { text: clip.hook })}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text pointer-coarse:h-11 pointer-coarse:w-11"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {clip.reason && (
        <p className="text-xs leading-relaxed text-text-muted">{clip.reason}</p>
      )}

      {clip.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {clip.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] text-text-muted"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {/* Trim: nudge each edge by a second (the AI saw keyframes only). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={t("videoClipper.clips.start")}
        >
          <span className="w-10 text-xs text-text-dim">
            {t("videoClipper.clips.start")}
          </span>
          {trimButton(
            "start",
            -NUDGE_SECONDS,
            t("videoClipper.clips.startEarlier"),
            Minus,
          )}
          {trimButton(
            "start",
            NUDGE_SECONDS,
            t("videoClipper.clips.startLater"),
            Plus,
          )}
        </div>
        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={t("videoClipper.clips.end")}
        >
          <span className="w-10 text-xs text-text-dim">
            {t("videoClipper.clips.end")}
          </span>
          {trimButton(
            "end",
            -NUDGE_SECONDS,
            t("videoClipper.clips.endEarlier"),
            Minus,
          )}
          {trimButton(
            "end",
            NUDGE_SECONDS,
            t("videoClipper.clips.endLater"),
            Plus,
          )}
        </div>
        {trimmed && (
          <button
            type="button"
            onClick={onResetRange}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:text-text disabled:cursor-not-allowed pointer-coarse:min-h-11"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {t("videoClipper.clips.resetTrim")}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {previewing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onStop}
            className="pointer-coarse:h-11"
          >
            <Square className="h-3.5 w-3.5" aria-hidden="true" />
            {t("videoClipper.clips.stop")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onPreview}
            disabled={!canPlay || exporting}
            className="pointer-coarse:h-11"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            {t("videoClipper.clips.preview")}
          </Button>
        )}

        {exporting ? (
          <>
            <div
              className="flex min-w-0 flex-1 items-center gap-2"
              role="status"
              aria-live="polite"
            >
              <div
                className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-surface-elevated"
                role="progressbar"
                aria-label={t("videoClipper.clips.export")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(exportState.progress * 100)}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-200"
                  style={{
                    width: `${Math.round(exportState.progress * 100)}%`,
                  }}
                />
              </div>
              <span className="shrink-0 text-xs text-text-muted tabular-nums">
                {t("videoClipper.clips.exporting", {
                  percent: Math.round(exportState.progress * 100),
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={onCancelExport}
              aria-label={t("videoClipper.clips.cancelExport")}
              title={t("videoClipper.clips.cancelExport")}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-elevated hover:text-text pointer-coarse:h-11 pointer-coarse:w-11"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <Button
            size="sm"
            onClick={onExport}
            disabled={!canPlay || !exportSupported || exportLocked}
            className="pointer-coarse:h-11"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t("videoClipper.clips.export")}
          </Button>
        )}
      </div>
      {!canPlay && (
        <p className="text-xs text-text-dim">
          {t("videoClipper.clips.needVideo")}
        </p>
      )}
    </article>
  );
}
