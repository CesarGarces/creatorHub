import {
  Activity,
  CalendarClock,
  Coins,
  Compass,
  Heart,
  Lightbulb,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";
import {
  DASHBOARD_WIDGET_IDS,
  type DashboardWidgetId,
} from "@creator-hub/shared-types";
import type { TranslationKey } from "@/i18n/translate";

/**
 * How much room a widget takes on wide screens. The dashboard is one column
 * on phones and tablets and two columns from `lg`: `full` widgets span both,
 * `half` widgets sit side by side.
 */
export type WidgetSpan = "full" | "half";

/** What the UI knows about a widget (never its data or its code). */
export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  nameKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: LucideIcon;
  span: WidgetSpan;
}

/**
 * The widget catalog: one entry per id of the shared contract
 * (`DASHBOARD_WIDGET_IDS`). Read by the dashboard grid, the skeletons and
 * Settings → Dashboard. Components are registered separately
 * (`components/dashboard-widgets/widget-loader.tsx`) so this module stays
 * free of widget code — importing it never pulls a widget bundle.
 */
export const WIDGET_CATALOG: Readonly<
  Record<DashboardWidgetId, DashboardWidgetMeta>
> = {
  "quick-prompt": {
    id: "quick-prompt",
    nameKey: "dashboard.widgets.quickPrompt.name",
    descriptionKey: "dashboard.widgets.quickPrompt.description",
    icon: Sparkles,
    span: "full",
  },
  favorites: {
    id: "favorites",
    nameKey: "dashboard.widgets.favorites.name",
    descriptionKey: "dashboard.widgets.favorites.description",
    icon: Star,
    span: "full",
  },
  "today-plans": {
    id: "today-plans",
    nameKey: "dashboard.widgets.todayPlans.name",
    descriptionKey: "dashboard.widgets.todayPlans.description",
    icon: CalendarClock,
    span: "half",
  },
  activity: {
    id: "activity",
    nameKey: "dashboard.widgets.activity.name",
    descriptionKey: "dashboard.widgets.activity.description",
    icon: Activity,
    span: "half",
  },
  recommendations: {
    id: "recommendations",
    nameKey: "dashboard.widgets.recommendations.name",
    descriptionKey: "dashboard.widgets.recommendations.description",
    icon: Compass,
    span: "half",
  },
  "asset-stats": {
    id: "asset-stats",
    nameKey: "dashboard.widgets.assetStats.name",
    descriptionKey: "dashboard.widgets.assetStats.description",
    icon: Heart,
    // Same size as "Plans for today": a card of rows, half a row on desktops.
    span: "half",
  },
  credits: {
    id: "credits",
    nameKey: "dashboard.widgets.credits.name",
    descriptionKey: "dashboard.widgets.credits.description",
    icon: Coins,
    span: "half",
  },
  tips: {
    id: "tips",
    nameKey: "dashboard.widgets.tips.name",
    descriptionKey: "dashboard.widgets.tips.description",
    icon: Lightbulb,
    span: "half",
  },
};

export function widgetMeta(id: DashboardWidgetId): DashboardWidgetMeta {
  return WIDGET_CATALOG[id];
}

/** Grid classes of a widget's cell (one column below `lg`). */
export function spanClass(span: WidgetSpan): string {
  return span === "full" ? "lg:col-span-2" : "lg:col-span-1";
}

/** Every widget of the shared contract, in contract order. */
export const ALL_WIDGETS: readonly DashboardWidgetMeta[] =
  DASHBOARD_WIDGET_IDS.map(widgetMeta);
