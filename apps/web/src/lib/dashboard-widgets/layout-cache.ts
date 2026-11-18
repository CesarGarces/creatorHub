import {
  normalizeDashboardWidgets,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";
import type { WidgetList } from "./layout";

/**
 * Last known dashboard layout, per browser. With it a returning user's own
 * widgets paint at once, in their order — instead of placeholders, then a
 * reflow when `GET /user/dashboard-layout` answers (CLS). The API stays the
 * source of truth: its answer replaces the cached list.
 *
 * Scoped to one user: a different account on the same browser never sees
 * (or briefly paints) someone else's layout.
 */
const STORAGE_KEY = "creator_hub.dashboard.layout";

interface CachedLayout {
  ownerId: string;
  widgets: unknown;
}

export function readCachedLayout(
  ownerId: string,
): DashboardWidgetState[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedLayout> | null;
    if (!cached || cached.ownerId !== ownerId) return null;
    return normalizeDashboardWidgets(cached.widgets);
  } catch {
    return null;
  }
}

export function writeCachedLayout(ownerId: string, widgets: WidgetList): void {
  try {
    const value: CachedLayout = { ownerId, widgets };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or disabled (private mode): the API still has the layout.
  }
}
