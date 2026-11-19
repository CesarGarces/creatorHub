import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { Skeleton, cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { QUICK_PROMPT_EXAMPLES } from "./widgets/quick-prompt-examples";

interface WidgetSkeletonProps {
  id: DashboardWidgetId;
  className?: string;
}

const title = <Skeleton className="mb-4 h-5 w-36" />;

function Rows({ count }: { count: number }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
          <Skeleton className="h-9 w-9 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The quick prompt's exact box (same paddings, the button's touch height)
 * and its examples row — real text, invisible, so it wraps like the widget
 * does in every language and screen width.
 */
function QuickPromptSkeleton() {
  const { t } = useI18n();
  return (
    <div className="relative sm:pb-6">
      <div className="rounded-xl border border-border bg-surface p-1">
        <div className="flex items-center gap-2 rounded-lg bg-surface-elevated px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
          <Skeleton className="h-4 flex-1" />
          <span className="invisible shrink-0 rounded-lg px-3 py-2 pointer-coarse:min-h-11 sm:px-4 text-sm font-medium">
            {t("dashboard.quickPrompt.generate")}
          </span>
        </div>
      </div>
      <div className="invisible mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs sm:absolute sm:bottom-0 sm:left-4 sm:mt-0 sm:flex-nowrap sm:px-0">
        <span>{t("dashboard.quickPrompt.try")}</span>
        {QUICK_PROMPT_EXAMPLES.map((key, i) => (
          <span key={key} className="contents">
            {i > 0 && <span>·</span>}
            <span>{t(key)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Placeholder of a widget while its code or data loads, with the widget's
 * real geometry (same grids, rows and heights): nothing below moves when
 * the widget arrives (CLS gate, ARCHITECTURE.md §2e).
 */
export function WidgetSkeleton({ id, className }: WidgetSkeletonProps) {
  return (
    <div aria-hidden="true" className={cn("h-full", className)}>
      {id === "quick-prompt" && <QuickPromptSkeleton />}
      {id === "favorites" && (
        <>
          {title}
          {/* Same size as ToolCard (p-5 + 44px row + mt-4). */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[102px] rounded-xl" />
            ))}
          </div>
        </>
      )}
      {(id === "activity" || id === "today-plans") && (
        <>
          {title}
          <Rows count={3} />
        </>
      )}
      {id === "recommendations" && (
        <div className="@container">
          {title}
          <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">
            <Skeleton className="h-[118px] rounded-xl" />
            <Skeleton className="h-[118px] rounded-xl" />
          </div>
        </div>
      )}
      {id === "asset-stats" && (
        <>
          {title}
          {/* Totals strip + rows, like "Plans for today". */}
          <div className="rounded-xl border border-border bg-surface">
            <div className="grid grid-cols-2 border-b border-border">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <Skeleton className="h-9 w-9 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                >
                  <Skeleton className="h-9 w-16 shrink-0 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {id === "credits" && (
        <>
          {title}
          <Skeleton className="h-[142px] rounded-xl" />
        </>
      )}
      {id === "tips" && (
        <>
          {title}
          {/* The card's minimum height (tips vary in length). */}
          <Skeleton className="h-[180px] rounded-xl" />
        </>
      )}
      {id === "voice-assistant" && (
        <>
          {title}
          {/* The card's minimum height, with the orb's place. */}
          <div className="flex h-[320px] flex-col items-center rounded-xl border border-border bg-surface pt-4">
            <Skeleton className="h-[168px] w-[168px] rounded-full" />
            <Skeleton className="mt-3 h-4 w-24" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </div>
        </>
      )}
    </div>
  );
}
