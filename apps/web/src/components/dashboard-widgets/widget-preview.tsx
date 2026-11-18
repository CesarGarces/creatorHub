import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { cn } from "@creator-hub/ui";

interface WidgetPreviewProps {
  id: DashboardWidgetId;
  /** Greyed out (the widget is hidden). */
  muted?: boolean;
  className?: string;
}

const line = "h-1 rounded-full bg-text-dim/40";

/**
 * A miniature of a widget (Settings → Dashboard): its shapes only — no
 * widget code or data is loaded to draw it. Decorative: the widget's name
 * is always shown next to it.
 */
export function WidgetPreview({ id, muted, className }: WidgetPreviewProps) {
  return (
    <div
      aria-hidden="true"
      data-widget-preview={id}
      className={cn(
        "flex h-full w-full flex-col justify-center gap-1 overflow-hidden rounded-md border border-border bg-bg p-1.5 transition-[filter,opacity]",
        muted && "opacity-60 grayscale",
        className,
      )}
    >
      {id === "quick-prompt" && (
        <>
          <div className="flex items-center gap-1 rounded-sm bg-surface-elevated p-1">
            <span className="text-[8px] leading-none text-primary">✦</span>
            <span className={cn(line, "flex-1")} />
            <span className="h-2 w-4 rounded-sm bg-primary" />
          </div>
          <div className="flex gap-1 px-0.5">
            <span className="h-1 w-3 rounded-full bg-primary/50" />
            <span className="h-1 w-4 rounded-full bg-primary/50" />
            <span className="h-1 w-3 rounded-full bg-primary/50" />
          </div>
        </>
      )}
      {id === "favorites" && (
        <div className="grid flex-1 grid-cols-4 gap-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-0.5 rounded-sm border border-border bg-surface p-0.5"
            >
              <span className="text-[7px] leading-none text-amber-400">★</span>
              <span className={line} />
            </div>
          ))}
        </div>
      )}
      {id === "today-plans" &&
        ["bg-sky-400", "bg-rose-400", "bg-emerald-400"].map((tone, i) => (
          <div key={tone} className="flex items-center gap-1">
            <span className="w-3 shrink-0 text-[7px] leading-none text-text-dim">
              {9 + i * 3}h
            </span>
            <span className={cn("h-full w-0.5 rounded-full", tone)} />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className={cn(line, i === 1 ? "w-2/3" : "w-5/6")} />
              <span className={cn(line, "w-1/2 bg-text-dim/25")} />
            </span>
          </div>
        ))}
      {id === "activity" &&
        Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-surface-elevated" />
            <span className={cn(line, i === 1 ? "w-1/2" : "w-3/4")} />
            <span className="ml-auto h-1.5 w-3 rounded-full bg-primary/40" />
          </div>
        ))}
      {id === "recommendations" && (
        <div className="grid flex-1 grid-cols-2 gap-1">
          {["bg-blue-500/50", "bg-cyan-500/50"].map((tone) => (
            <div
              key={tone}
              className="flex items-start gap-0.5 rounded-sm border border-border bg-surface p-0.5"
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-sm", tone)} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className={line} />
                <span className={cn(line, "w-2/3")} />
              </span>
            </div>
          ))}
        </div>
      )}
      {id === "asset-stats" && (
        <>
          <div className="flex gap-1">
            <span className="flex flex-1 items-center gap-0.5 rounded-sm bg-surface-elevated p-0.5">
              <span className="text-[7px] leading-none text-rose-400">♥</span>
              <span className="h-1.5 w-3 rounded-sm bg-text/70" />
            </span>
            <span className="flex flex-1 items-center gap-0.5 rounded-sm bg-surface-elevated p-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span className="h-1.5 w-4 rounded-sm bg-text/70" />
            </span>
          </div>
          {["from-fuchsia-500/60", "from-amber-500/60"].map((tone) => (
            <div key={tone} className="flex items-center gap-1">
              <span
                className={cn(
                  "h-2.5 w-4 shrink-0 rounded-sm bg-gradient-to-br to-surface-elevated",
                  tone,
                )}
              />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className={cn(line, "w-3/4")} />
                <span className={cn(line, "w-1/3 bg-rose-400/40")} />
              </span>
            </div>
          ))}
        </>
      )}
      {id === "credits" && (
        <>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/40" />
            <span className="h-2 w-7 rounded-sm bg-text/70" />
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className={cn(line, "w-1/3")} />
            <span className="h-2 w-5 rounded-sm bg-primary" />
          </div>
        </>
      )}
      {id === "voice-assistant" && (
        <div className="flex flex-col items-center gap-1">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-300 via-indigo-500 to-fuchsia-500 opacity-90" />
            <span className="absolute -inset-1 rounded-full border border-fuchsia-400/40" />
            <span className="absolute -right-1 top-0 h-0.5 w-0.5 rounded-full bg-violet-200" />
            <span className="absolute -left-1 bottom-1 h-0.5 w-0.5 rounded-full bg-sky-200" />
          </span>
          <span className={cn(line, "w-1/3")} />
        </div>
      )}
      {id === "tips" && (
        <div className="flex items-start gap-1">
          <span className="text-[8px] leading-none">💡</span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className={line} />
            <span className={cn(line, "w-4/5")} />
            <span className={cn(line, "w-1/2")} />
          </span>
        </div>
      )}
    </div>
  );
}
