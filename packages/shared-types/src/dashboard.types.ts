/**
 * Dashboard widgets (see ARCHITECTURE.md §2f "Dashboard widgets").
 *
 * The dashboard is a list of widgets the user can show, hide and reorder.
 * This is the wire contract between the web app and the API
 * (`GET/PUT/DELETE /user/dashboard-layout`): the API validates ids against
 * `DASHBOARD_WIDGET_IDS` and both sides read stored/received layouts through
 * `normalizeDashboardWidgets()`, so a layout saved by an older or newer
 * version of the app is always usable.
 *
 * Adding a widget = add its id here (and to `DEFAULT_DASHBOARD_WIDGETS`),
 * then register its component in the web app. Existing users get it
 * appended at the end with its default visibility — no migration needed.
 */
export const DASHBOARD_WIDGET_IDS = [
  "quick-prompt",
  "today-plans",
  "voice-assistant",
  "favorites",
  "activity",
  "recommendations",
  "credits",
  "tips",
  "asset-stats",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

/** One widget of a user's dashboard: its place is its index in the list. */
export interface DashboardWidgetState {
  id: DashboardWidgetId;
  visible: boolean;
}

/** Body of `GET /user/dashboard-layout` (and of PUT/DELETE). */
export interface DashboardLayout {
  /** Every known widget exactly once, in display order. */
  widgets: DashboardWidgetState[];
  /** Last saved change; `null` = the user never customized the dashboard. */
  updatedAt: string | null;
}

/**
 * The dashboard before any customization: the default order and visibility,
 * also restored by "Reset to default" (Settings → Dashboard).
 */
export const DEFAULT_DASHBOARD_WIDGETS: readonly Readonly<DashboardWidgetState>[] =
  [
    { id: "quick-prompt", visible: true },
    // Today's Content Planner sessions, next to Robotina on desktops.
    { id: "today-plans", visible: true },
    // Robotina: tap the orb and talk (voice in, Deepgram voice out).
    { id: "voice-assistant", visible: true },
    { id: "favorites", visible: true },
    // Likes and views of the user's assets, with previews.
    { id: "asset-stats", visible: true },
    { id: "activity", visible: true },
    { id: "recommendations", visible: true },
    { id: "credits", visible: true },
    { id: "tips", visible: true },
  ];

export function isDashboardWidgetId(
  value: unknown,
): value is DashboardWidgetId {
  return (
    typeof value === "string" &&
    (DASHBOARD_WIDGET_IDS as readonly string[]).includes(value)
  );
}

/**
 * Turns any value (stored JSON, an API body, a local cache) into a complete,
 * valid widget list:
 * - keeps the order of the known widgets it contains (first occurrence wins);
 * - drops unknown ids and entries that aren't `{ id, visible }`-like;
 * - a missing/non-boolean `visible` falls back to the widget's default;
 * - widgets it doesn't mention are appended in their default order and
 *   visibility (new widgets reach existing users this way).
 *
 * Never throws; anything that isn't an array yields the default layout.
 */
export function normalizeDashboardWidgets(
  value: unknown,
): DashboardWidgetState[] {
  const defaults = new Map(
    DEFAULT_DASHBOARD_WIDGETS.map((w) => [w.id, w.visible] as const),
  );
  const result: DashboardWidgetState[] = [];
  const seen = new Set<DashboardWidgetId>();

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue;
      const { id, visible } = entry as { id?: unknown; visible?: unknown };
      if (!isDashboardWidgetId(id) || seen.has(id)) continue;
      seen.add(id);
      result.push({
        id,
        visible: typeof visible === "boolean" ? visible : defaults.get(id)!,
      });
    }
  }

  for (const widget of DEFAULT_DASHBOARD_WIDGETS) {
    if (!seen.has(widget.id)) result.push({ ...widget });
  }
  return result;
}
