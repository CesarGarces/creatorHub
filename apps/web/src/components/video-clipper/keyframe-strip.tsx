"use client";

import { Skeleton, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { formatClipTime, formatSeconds } from "@/lib/video-clipper/format";
import type { Keyframe } from "@/lib/video-clipper/types";

export interface KeyframeStripProps {
  /** Keyframes sampled so far. */
  frames: Keyframe[];
  /** Keyframes planned for the video (placeholders fill the rest). */
  total: number;
  durationSec: number;
  /** Highlights the frame closest to this time (e.g. the player position). */
  activeTime?: number | null;
  /** Jump the player to a frame. */
  onSelect?: (timestamp: number) => void;
  className?: string;
}

/** The compressed keyframes that will be sent to the AI, in a swipeable row. */
export function KeyframeStrip({
  frames,
  total,
  durationSec,
  activeTime = null,
  onSelect,
  className,
}: KeyframeStripProps) {
  const { t } = useI18n();
  const placeholders = Math.max(0, total - frames.length);
  const interval = total > 0 ? durationSec / total : 0;
  const activeIndex =
    activeTime === null || frames.length === 0
      ? -1
      : frames.reduce(
          (best, f, i) =>
            Math.abs(f.timestamp - activeTime) <
            Math.abs(frames[best]!.timestamp - activeTime)
              ? i
              : best,
          0,
        );

  return (
    <section
      aria-label={t("videoClipper.video.keyframesLabel")}
      className={className}
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium text-text">
          {t("videoClipper.video.keyframes", { count: total })}
        </h3>
        {interval > 0 && (
          <p className="text-xs text-text-dim">
            {t("videoClipper.video.keyframesHint", {
              interval: formatSeconds(interval),
            })}
          </p>
        )}
      </div>
      <ul
        data-scroll-x
        className="-mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2 scrollbar-none"
      >
        {frames.map((frame, i) => {
          const time = formatClipTime(frame.timestamp);
          return (
            <li key={frame.timestamp} className="shrink-0">
              <button
                type="button"
                onClick={() => onSelect?.(frame.timestamp)}
                disabled={!onSelect}
                aria-label={t("videoClipper.video.seekTo", { time })}
                aria-current={i === activeIndex ? "true" : undefined}
                className={cn(
                  "group block w-24 overflow-hidden rounded-md border bg-surface-elevated text-left transition-colors sm:w-28",
                  i === activeIndex
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {/* Plain <img>: a local data URL, nothing for next/image to optimize. */}
                <img
                  src={frame.dataUrl}
                  alt={t("videoClipper.video.keyframeAlt", { time })}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <span className="block px-1.5 py-1 font-mono text-[11px] text-text-muted tabular-nums">
                  {time}
                </span>
              </button>
            </li>
          );
        })}
        {Array.from({ length: placeholders }, (_, i) => (
          <li key={`placeholder-${i}`} className="shrink-0" aria-hidden="true">
            <Skeleton className="aspect-video w-24 rounded-md sm:w-28" />
          </li>
        ))}
      </ul>
    </section>
  );
}
