import {
  DEFAULT_DASHBOARD_WIDGETS,
  normalizeDashboardWidgets,
  type DashboardWidgetId,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";

/**
 * Pure operations on a dashboard layout: the complete, ordered list of
 * widgets with their visibility (see `normalizeDashboardWidgets`). Hidden
 * widgets keep their place in the list, so showing one again puts it back
 * where it was. Every function returns a new list and never mutates its
 * input; a no-op returns the same list (cheap equality for React/Zustand).
 */
export type WidgetList = readonly DashboardWidgetState[];

export function defaultWidgets(): DashboardWidgetState[] {
  return normalizeDashboardWidgets(undefined);
}

/** Ids of the widgets shown on the dashboard, in order. */
export function visibleWidgetIds(widgets: WidgetList): DashboardWidgetId[] {
  return widgets.filter((w) => w.visible).map((w) => w.id);
}

export function sameWidgets(a: WidgetList, b: WidgetList): boolean {
  return (
    a.length === b.length &&
    a.every((w, i) => w.id === b[i]!.id && w.visible === b[i]!.visible)
  );
}

export function isDefaultLayout(widgets: WidgetList): boolean {
  return sameWidgets(widgets, DEFAULT_DASHBOARD_WIDGETS);
}

export function setWidgetVisible(
  widgets: WidgetList,
  id: DashboardWidgetId,
  visible: boolean,
): WidgetList {
  const current = widgets.find((w) => w.id === id);
  if (!current || current.visible === visible) return widgets;
  return widgets.map((w) => (w.id === id ? { ...w, visible } : w));
}

/**
 * Moves a widget one place up (`-1`) or down (`+1`) in the full list
 * (Settings → Dashboard, the single-pointer alternative to dragging).
 */
export function moveWidget(
  widgets: WidgetList,
  id: DashboardWidgetId,
  delta: -1 | 1,
): WidgetList {
  const from = widgets.findIndex((w) => w.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= widgets.length) return widgets;
  const next = [...widgets];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

/**
 * Applies a new order of the *visible* widgets (a drag on the dashboard):
 * the visible widgets fill the places visible widgets had, in the new
 * order; hidden ones don't move. Anything but a permutation of the visible
 * ids is ignored.
 */
export function reorderVisible(
  widgets: WidgetList,
  orderedVisibleIds: readonly DashboardWidgetId[],
): WidgetList {
  const visible = visibleWidgetIds(widgets);
  const isPermutation =
    orderedVisibleIds.length === visible.length &&
    new Set(orderedVisibleIds).size === visible.length &&
    orderedVisibleIds.every((id) => visible.includes(id));
  if (!isPermutation) return widgets;
  if (orderedVisibleIds.every((id, i) => id === visible[i])) return widgets;

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const next = [...widgets];
  let k = 0;
  widgets.forEach((w, slot) => {
    if (w.visible) next[slot] = byId.get(orderedVisibleIds[k++]!)!;
  });
  return next;
}
