"use client";

import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { widgetMeta } from "@/lib/dashboard-widgets/catalog";
import { WidgetPreview } from "./widget-preview";

export type PreviewDevice = "desktop" | "phone";

interface DashboardLayoutPreviewProps {
  /** Visible widgets, in order. */
  widgetIds: readonly DashboardWidgetId[];
  device: PreviewDevice;
  className?: string;
}

/** Miniature heights, roughly proportional to the real widgets. */
const HEIGHT: Record<DashboardWidgetId, string> = {
  "quick-prompt": "h-8",
  favorites: "h-12",
  "today-plans": "h-14",
  activity: "h-14",
  recommendations: "h-14",
  credits: "h-12",
  "asset-stats": "h-14",
  tips: "h-10",
  "voice-assistant": "h-16",
};

/**
 * The dashboard in miniature, as it will look: two columns with the real
 * widget sizes on a desktop, one column on a phone. Updates as widgets are
 * shown, hidden or moved.
 */
export function DashboardLayoutPreview({
  widgetIds,
  device,
  className,
}: DashboardLayoutPreviewProps) {
  const { t } = useI18n();
  const phone = device === "phone";

  return (
    <figure
      aria-label={t("settings.dashboard.previewLabel")}
      data-device={device}
      className={cn(
        "mx-auto rounded-xl border border-border bg-surface-elevated/40 p-2 transition-[max-width] duration-300 ease-out",
        phone ? "max-w-[13rem] rounded-[1.25rem] p-2.5" : "max-w-full",
        className,
      )}
    >
      {phone && (
        // The phone's speaker slot.
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-1 w-10 rounded-full bg-border"
        />
      )}
      {widgetIds.length === 0 ? (
        <p className="flex h-24 items-center justify-center text-xs text-text-muted">
          {t("settings.dashboard.previewEmpty")}
        </p>
      ) : (
        <ol className={cn("grid gap-2", phone ? "grid-cols-1" : "grid-cols-2")}>
          {widgetIds.map((id) => {
            const meta = widgetMeta(id);
            return (
              <li
                key={id}
                data-preview-widget={id}
                className={cn(
                  "flex min-w-0 flex-col gap-1 animate-in fade-in zoom-in-95 duration-200",
                  !phone && meta.span === "full" && "col-span-2",
                )}
              >
                <span className="truncate text-[10px] font-medium leading-none text-text-muted">
                  {t(meta.nameKey)}
                </span>
                <WidgetPreview id={id} className={HEIGHT[id]} />
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
