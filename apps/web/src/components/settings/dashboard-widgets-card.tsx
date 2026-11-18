"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Hand,
  LayoutDashboard,
  Monitor,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import type { DashboardWidgetId } from "@creator-hub/shared-types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Switch,
  cn,
} from "@creator-hub/ui";
import { useAuthStore } from "@/store/auth.store";
import { useDashboardLayoutStore } from "@/store/dashboard-layout.store";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useI18n } from "@/i18n/i18n-provider";
import { widgetMeta } from "@/lib/dashboard-widgets/catalog";
import {
  isDefaultLayout,
  visibleWidgetIds,
} from "@/lib/dashboard-widgets/layout";
import {
  DashboardLayoutPreview,
  type PreviewDevice,
} from "@/components/dashboard-widgets/layout-preview";
import { WidgetPreview } from "@/components/dashboard-widgets/widget-preview";

/** Anchor of this section ("Add widgets" on the dashboard links here). */
export const DASHBOARD_SETTINGS_ID = "dashboard";

const iconButton =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors hover:bg-surface-elevated hover:text-text disabled:pointer-events-none disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * Settings → Dashboard: choose the dashboard's widgets (each with a
 * preview), show or hide them, and put them in order — with the up/down
 * buttons (no dragging needed) or by pressing and holding a widget on the
 * dashboard itself. A live preview shows the result on a desktop or a
 * phone. Every change is saved right away.
 */
export function DashboardWidgetsCard() {
  const { t } = useI18n();
  const userId = useAuthStore((s) => s.user?.id);
  const widgets = useDashboardLayoutStore((s) => s.widgets);
  const isHydrated = useDashboardLayoutStore((s) => s.isHydrated);
  const saveErrors = useDashboardLayoutStore((s) => s.saveErrors);
  const load = useDashboardLayoutStore((s) => s.load);
  const setVisible = useDashboardLayoutStore((s) => s.setVisible);
  const move = useDashboardLayoutStore((s) => s.move);
  const reset = useDashboardLayoutStore((s) => s.reset);

  const isDesktop = useIsDesktop();
  const [chosenDevice, setChosenDevice] = useState<PreviewDevice | null>(null);
  const device = chosenDevice ?? (isDesktop ? "desktop" : "phone");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    void load(userId);
  }, [load, userId]);

  // Reached through "Add widgets" (/settings#dashboard).
  useEffect(() => {
    if (window.location.hash === `#${DASHBOARD_SETTINGS_ID}`) {
      document
        .getElementById(DASHBOARD_SETTINGS_ID)
        ?.scrollIntoView({ block: "start" });
    }
  }, []);

  const seenErrors = useRef(saveErrors);
  useEffect(() => {
    if (saveErrors > seenErrors.current) {
      toast.error(t("settings.dashboard.saveFailed"));
    }
    seenErrors.current = saveErrors;
  }, [saveErrors, t]);

  const shown = useMemo(() => visibleWidgetIds(widgets), [widgets]);
  const disabled = !isHydrated;

  const moveBy = (id: DashboardWidgetId, delta: -1 | 1) => {
    const position = widgets.findIndex((w) => w.id === id) + 1 + delta;
    move(id, delta);
    setAnnouncement(
      t("settings.dashboard.moved", {
        name: t(widgetMeta(id).nameKey),
        position,
      }),
    );
  };

  const onReset = async () => {
    await reset();
    if (isDefaultLayout(useDashboardLayoutStore.getState().saved)) {
      toast.success(t("settings.dashboard.resetDone"));
    }
  };

  return (
    <Card id={DASHBOARD_SETTINGS_ID} className="scroll-mt-20">
      <CardHeader>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-text">
          <LayoutDashboard
            className="h-5 w-5 text-primary"
            aria-hidden="true"
          />
          {t("settings.dashboard.title")}
        </h2>
        <p className="text-sm text-text-muted">
          {t("settings.dashboard.description")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live preview */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-text">
              {t("settings.dashboard.preview")}
            </h3>
            <div
              role="group"
              aria-label={t("settings.dashboard.previewDevice")}
              className="inline-flex rounded-lg border border-border bg-surface p-0.5"
            >
              {(
                [
                  ["desktop", Monitor, "settings.dashboard.desktop"],
                  ["phone", Smartphone, "settings.dashboard.phone"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={device === value}
                  onClick={() => setChosenDevice(value)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors pointer-coarse:h-11",
                    device === value
                      ? "bg-primary/15 text-primary"
                      : "text-text-muted hover:text-text",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <DashboardLayoutPreview widgetIds={shown} device={device} />
        </div>

        {/* The widgets: preview, name, order, shown/hidden */}
        <div>
          <h3
            id="dashboard-widgets-label"
            className="mb-3 text-sm font-medium text-text"
          >
            {t("settings.dashboard.widgetsLabel")}
          </h3>
          <ul
            aria-labelledby="dashboard-widgets-label"
            className="divide-y divide-border rounded-xl border border-border"
          >
            {widgets.map((widget, index) => {
              const meta = widgetMeta(widget.id);
              const name = t(meta.nameKey);
              return (
                <li
                  key={widget.id}
                  data-widget-row={widget.id}
                  className="grid grid-cols-[4.5rem_1fr] items-center gap-x-3 gap-y-3 p-3 sm:grid-cols-[6rem_1fr_auto] sm:p-4"
                >
                  <WidgetPreview
                    id={widget.id}
                    muted={!widget.visible}
                    className="h-12 sm:h-14"
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      <meta.icon
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {name}
                      {!widget.visible && (
                        <Badge variant="default" size="sm">
                          {t("settings.dashboard.hiddenBadge")}
                        </Badge>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {t(meta.descriptionKey)}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => moveBy(widget.id, -1)}
                      disabled={disabled || index === 0}
                      aria-label={t("settings.dashboard.moveUp", { name })}
                      className={iconButton}
                    >
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBy(widget.id, 1)}
                      disabled={disabled || index === widgets.length - 1}
                      aria-label={t("settings.dashboard.moveDown", { name })}
                      className={iconButton}
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <Switch
                      checked={widget.visible}
                      onCheckedChange={(on) => setVisible(widget.id, on)}
                      disabled={disabled}
                      aria-label={t("settings.dashboard.show", { name })}
                      className="ml-1"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>

        <p className="flex items-start gap-2 text-xs text-text-muted">
          <Hand className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t("settings.dashboard.tip")}
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="secondary"
            onClick={onReset}
            disabled={disabled || isDefaultLayout(widgets)}
            className="gap-2 pointer-coarse:h-11"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {t("settings.dashboard.reset")}
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover pointer-coarse:min-h-11"
          >
            {t("settings.dashboard.openDashboard")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
