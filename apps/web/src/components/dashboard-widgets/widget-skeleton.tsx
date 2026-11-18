import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { Skeleton, cn } from "@creator-hub/ui";

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
 * Placeholder of a widget while its code or data loads, with the widget's
 * real geometry (same grids, rows and heights): nothing below moves when
 * the widget arrives (CLS gate, ARCHITECTURE.md §2e).
 */
export function WidgetSkeleton({ id, className }: WidgetSkeletonProps) {
  return (
    <div aria-hidden="true" className={cn("h-full", className)}>
      {id === "quick-prompt" && (
        <div className="sm:pb-6">
          <Skeleton className="h-[50px] rounded-xl sm:h-[58px]" />
          <Skeleton className="mt-3 h-4 w-3/4 sm:hidden" />
        </div>
      )}
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
