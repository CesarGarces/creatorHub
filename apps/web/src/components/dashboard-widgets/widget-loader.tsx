"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { WidgetSkeleton } from "./widget-skeleton";

/**
 * Widget components, one lazy chunk each (`next/dynamic`): the dashboard
 * ships only the grid; a widget's code — and the data it fetches on mount —
 * loads when the widget is shown and near the viewport
 * (`SortableWidget` + `useInView`). Hidden widgets cost nothing.
 *
 * The `loading` placeholder has the widget's geometry (no layout shift).
 * Adding a widget: its id in `@creator-hub/shared-types`, its entry in
 * `lib/dashboard-widgets/catalog.ts`, and its component here.
 */
export const WIDGET_COMPONENTS: Record<DashboardWidgetId, ComponentType> = {
  "quick-prompt": dynamic(
    () =>
      import("./widgets/quick-prompt-widget").then((m) => m.QuickPromptWidget),
    { loading: () => <WidgetSkeleton id="quick-prompt" /> },
  ),
  favorites: dynamic(
    () => import("./widgets/favorites-widget").then((m) => m.FavoritesWidget),
    { loading: () => <WidgetSkeleton id="favorites" /> },
  ),
  "today-plans": dynamic(
    () =>
      import("./widgets/today-plans-widget").then((m) => m.TodayPlansWidget),
    { loading: () => <WidgetSkeleton id="today-plans" /> },
  ),
  activity: dynamic(
    () => import("./widgets/activity-widget").then((m) => m.ActivityWidget),
    { loading: () => <WidgetSkeleton id="activity" /> },
  ),
  recommendations: dynamic(
    () =>
      import("./widgets/recommendations-widget").then(
        (m) => m.RecommendationsWidget,
      ),
    { loading: () => <WidgetSkeleton id="recommendations" /> },
  ),
  "asset-stats": dynamic(
    () =>
      import("./widgets/asset-stats-widget").then((m) => m.AssetStatsWidget),
    { loading: () => <WidgetSkeleton id="asset-stats" /> },
  ),
  credits: dynamic(
    () => import("./widgets/credits-widget").then((m) => m.CreditsWidget),
    { loading: () => <WidgetSkeleton id="credits" /> },
  ),
  tips: dynamic(
    () => import("./widgets/tips-widget").then((m) => m.TipsWidget),
    { loading: () => <WidgetSkeleton id="tips" /> },
  ),
};
