import { create } from "zustand";
import {
  normalizeDashboardWidgets,
  type DashboardLayout,
  type DashboardWidgetId,
} from "@creator-hub/shared-types";
import api from "@/lib/api";
import {
  defaultWidgets,
  moveWidget,
  reorderVisible,
  sameWidgets,
  setWidgetVisible,
  type WidgetList,
} from "@/lib/dashboard-widgets/layout";
import {
  readCachedLayout,
  writeCachedLayout,
} from "@/lib/dashboard-widgets/layout-cache";

const ENDPOINT = "/user/dashboard-layout";

/**
 * The user's dashboard widgets: order and visibility (ARCHITECTURE.md §2f).
 *
 * Changes are optimistic — the dashboard and Settings update at once — and
 * saved in the background through a serial queue: one request at a time,
 * each sending the latest layout (quick toggles collapse into one save, and
 * a reset can't be overtaken by an older save). A failed save puts back the
 * last saved layout (unless newer changes are waiting) and bumps
 * `saveErrors`, which the pages turn into a toast.
 */
interface DashboardLayoutState {
  widgets: WidgetList;
  /** Last layout the API confirmed (what a failed save reverts to). */
  saved: WidgetList;
  /** `widgets` is the user's (cache or API), not a placeholder guess. */
  isHydrated: boolean;
  /** User the layout belongs to (null = not loaded / signed out). */
  ownerId: string | null;
  isSaving: boolean;
  /** Failed saves so far; watch it to tell the user. */
  saveErrors: number;

  /** Cached layout at once, then the API's. */
  load: (userId: string | null | undefined) => Promise<void>;
  setVisible: (id: DashboardWidgetId, visible: boolean) => void;
  move: (id: DashboardWidgetId, delta: -1 | 1) => void;
  /** New order of the visible widgets (a drag on the dashboard). */
  reorderVisible: (orderedVisibleIds: readonly DashboardWidgetId[]) => void;
  /** Replaces the whole list (e.g. "Undo"). */
  replace: (widgets: WidgetList) => void;
  reset: () => Promise<void>;
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()((
  set,
  get,
) => {
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>) =>
    (queue = queue.then(task, task));

  const cache = (widgets: WidgetList) => {
    const { ownerId } = get();
    if (ownerId) writeCachedLayout(ownerId, widgets);
  };

  /** Shows `widgets` now and queues saving it. */
  const update = (widgets: WidgetList) => {
    if (widgets === get().widgets) return;
    set({ widgets });
    cache(widgets);
    void enqueue(sync);
  };

  const failed = (sent: WidgetList) => {
    const { widgets, saved } = get();
    // Newer changes are queued: they get their own save attempt.
    if (sameWidgets(widgets, sent)) {
      set({ widgets: saved });
      cache(saved);
    }
    set((s) => ({ saveErrors: s.saveErrors + 1 }));
  };

  const write = async (sent: WidgetList, request: () => Promise<unknown>) => {
    set({ isSaving: true });
    try {
      await request();
      set({ saved: sent });
    } catch {
      failed(sent);
    } finally {
      set({ isSaving: false });
    }
  };

  /** Saves the latest layout, if it isn't saved already. */
  async function sync() {
    const sent = get().widgets;
    if (sameWidgets(sent, get().saved)) return;
    await write(sent, () => api.put(ENDPOINT, { widgets: sent }));
  }

  return {
    widgets: defaultWidgets(),
    saved: defaultWidgets(),
    isHydrated: false,
    ownerId: null,
    isSaving: false,
    saveErrors: 0,

    load: async (userId) => {
      const ownerId = userId ?? null;
      if (get().ownerId !== ownerId) {
        const cached = ownerId ? readCachedLayout(ownerId) : null;
        const widgets = cached ?? defaultWidgets();
        set({ ownerId, widgets, saved: widgets, isHydrated: !!cached });
      }
      if (!ownerId) return;

      try {
        const layout = await api.get<Partial<DashboardLayout>>(ENDPOINT);
        const remote = normalizeDashboardWidgets(layout?.widgets);
        const state = get();
        if (state.ownerId !== ownerId) return; // signed out/in meanwhile
        // Local changes not saved yet win; their save is on its way.
        if (state.isSaving || !sameWidgets(state.widgets, state.saved)) {
          set({ isHydrated: true });
          return;
        }
        set({
          widgets: sameWidgets(remote, state.widgets) ? state.widgets : remote,
          saved: remote,
          isHydrated: true,
        });
        cache(remote);
      } catch {
        // Offline or an older API: the cached/default layout stays usable.
        set({ isHydrated: true });
      }
    },

    setVisible: (id, visible) =>
      update(setWidgetVisible(get().widgets, id, visible)),

    move: (id, delta) => update(moveWidget(get().widgets, id, delta)),

    reorderVisible: (ids) => update(reorderVisible(get().widgets, ids)),

    replace: (widgets) =>
      update(
        sameWidgets(widgets, get().widgets)
          ? get().widgets
          : normalizeDashboardWidgets(widgets),
      ),

    reset: () => {
      const widgets = defaultWidgets();
      set({ widgets });
      cache(widgets);
      // DELETE (not PUT): users on the default follow future defaults.
      return enqueue(() => write(widgets, () => api.delete(ENDPOINT)));
    },
  };
});
