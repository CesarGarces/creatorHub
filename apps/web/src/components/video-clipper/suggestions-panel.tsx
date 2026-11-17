"use client";

import { Copy, Hash, Lightbulb, Sparkles, Type } from "lucide-react";
import { Badge, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import type { VideoAnalysisResult } from "@/lib/video-clipper/types";

export interface SuggestionsPanelProps {
  result: Pick<
    VideoAnalysisResult,
    "summary" | "contentType" | "titles" | "hooks" | "hashtags" | "model"
  >;
  /** Copies a text (the page shows the toast). */
  onCopy: (text: string) => void;
  className?: string;
}

/** Summary, optimized titles, hooks and hashtags from the analysis. */
export function SuggestionsPanel({
  result,
  onCopy,
  className,
}: SuggestionsPanelProps) {
  const { t } = useI18n();

  const copyButton = (text: string) => (
    <button
      type="button"
      onClick={() => onCopy(text)}
      aria-label={t("videoClipper.results.copyItem", { text })}
      title={t("videoClipper.results.copy")}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-elevated hover:text-text pointer-coarse:h-11 pointer-coarse:w-11"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );

  return (
    <div className={cn("space-y-5", className)} data-testid="suggestions-panel">
      {result.summary && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-text">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("videoClipper.results.summary")}
            {result.contentType && <Badge>{result.contentType}</Badge>}
          </h3>
          <p className="text-sm leading-relaxed text-text-muted">
            {result.summary}
          </p>
          <p className="mt-1 text-xs text-text-dim">
            {t("videoClipper.results.model", { model: result.model.name })}
          </p>
        </section>
      )}

      {result.titles.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-text">
            <Type className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("videoClipper.results.titles")}
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {result.titles.map((title) => (
              <li
                key={title.text}
                className="flex items-center gap-2 py-1 pl-3 pr-1"
              >
                <span className="min-w-0 flex-1 text-sm text-text">
                  {title.text}
                </span>
                {title.platform && (
                  <span className="hidden shrink-0 text-[11px] text-text-dim sm:inline">
                    {title.platform}
                  </span>
                )}
                {copyButton(title.text)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.hooks.length > 0 && (
        <section>
          <h3 className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-text">
            <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
            {t("videoClipper.results.hooks")}
          </h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {result.hooks.map((hook) => (
              <li
                key={hook.text}
                className="flex items-center gap-2 py-1 pl-3 pr-1"
              >
                <span className="min-w-0 flex-1 text-sm text-text">
                  {hook.text}
                  {hook.style && (
                    <span className="ml-2 text-[11px] text-text-dim">
                      {hook.style}
                    </span>
                  )}
                </span>
                {copyButton(hook.text)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.hashtags.length > 0 && (
        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
              <Hash className="h-4 w-4 text-primary" aria-hidden="true" />
              {t("videoClipper.results.hashtags")}
            </h3>
            <button
              type="button"
              onClick={() => onCopy(result.hashtags.join(" "))}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-light pointer-coarse:min-h-11"
            >
              {t("videoClipper.results.copyAll")}
            </button>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {result.hashtags.map((tag) => (
              <li
                key={tag}
                className="rounded-full bg-primary-light px-2.5 py-0.5 text-xs text-primary"
              >
                {tag}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
