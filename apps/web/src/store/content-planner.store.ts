import { create } from "zustand";
import api from "@/lib/api";
import {
  shiftCursor,
  visibleRange,
  type PlannerView,
} from "@/lib/content-planner/dates";
import type { SavedProductionStep } from "@/lib/content-planner/steps";
import type { PaletteColor, PaletteIcon } from "@/lib/content-planner/palette";
import type {
  ContentCustomPlatform,
  ContentCustomType,
  ContentEvent,
  ContentEventConflict,
  ContentEventInput,
  ContentEventPatch,
  ContentPlannerStats,
  ContentProject,
  ContentProjectInput,
} from "@/lib/content-planner/types";

const BASE = "/tools/content-planner";

interface MutationResult<T> {
  success: boolean;
  data: T;
  conflicts: ContentEventConflict[];
}

interface ContentPlannerState {
  view: PlannerView;
  /** Any date inside the period on screen. */
  cursor: Date;
  events: ContentEvent[];
  projects: ContentProject[];
  customTypes: ContentCustomType[];
  customPlatforms: ContentCustomPlatform[];
  /** The user's saved production steps; [] = built-in; null = not loaded. */
  productionSteps: SavedProductionStep[] | null;
  /** Totals over the whole calendar; null until loaded. */
  stats: ContentPlannerStats | null;
  isLoadingEvents: boolean;
  eventsError: string | null;
  /** Only highlight this project's sessions (null = all). */
  focusedProjectId: string | null;

  setView: (view: PlannerView) => void;
  setCursor: (cursor: Date) => void;
  goToday: () => void;
  shift: (direction: 1 | -1) => void;
  setFocusedProject: (projectId: string | null) => void;

  fetchEvents: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchCustomTypes: () => Promise<void>;
  /** Throws on failure (e.g. duplicate name). */
  createCustomType: (
    name: string,
    color: PaletteColor,
    icon?: PaletteIcon,
  ) => Promise<ContentCustomType>;
  deleteCustomType: (id: string) => Promise<void>;
  fetchCustomPlatforms: () => Promise<void>;
  /** Throws on failure (e.g. duplicate name). */
  createCustomPlatform: (name: string) => Promise<ContentCustomPlatform>;
  deleteCustomPlatform: (id: string) => Promise<void>;
  fetchProductionSteps: () => Promise<void>;
  /** Remembers the steps used for the next plan. Throws on failure. */
  saveProductionSteps: (steps: SavedProductionStep[]) => Promise<void>;
  /** The mutations throw on failure and resolve with overlap warnings. */
  createEvent: (input: ContentEventInput) => Promise<ContentEventConflict[]>;
  updateEvent: (
    id: string,
    patch: ContentEventPatch,
  ) => Promise<ContentEventConflict[]>;
  deleteEvent: (id: string) => Promise<void>;
  createProject: (
    input: ContentProjectInput,
  ) => Promise<{ projectId: string; conflicts: ContentEventConflict[] }>;
  deleteProject: (id: string) => Promise<void>;
}

const byStart = (a: ContentEvent, b: ContentEvent) =>
  a.startAt.localeCompare(b.startAt);

// Ignores responses to requests that were superseded (fast navigation).
let latestEventsRequest = 0;

export const useContentPlannerStore = create<ContentPlannerState>()(
  (set, get) => ({
    view: "week",
    cursor: new Date(),
    events: [],
    projects: [],
    customTypes: [],
    customPlatforms: [],
    productionSteps: null,
    stats: null,
    isLoadingEvents: false,
    eventsError: null,
    focusedProjectId: null,

    setView: (view) => set({ view }),
    setCursor: (cursor) => set({ cursor }),
    goToday: () => set({ cursor: new Date() }),
    shift: (direction) =>
      set((s) => ({ cursor: shiftCursor(s.view, s.cursor, direction) })),
    setFocusedProject: (focusedProjectId) => set({ focusedProjectId }),

    fetchEvents: async () => {
      const requestId = ++latestEventsRequest;
      const { from, to } = visibleRange(get().view, get().cursor);
      set({ isLoadingEvents: true, eventsError: null });
      try {
        const response = await api.get<{ data: ContentEvent[] }>(
          `${BASE}/events`,
          { params: { from: from.toISOString(), to: to.toISOString() } },
        );
        if (requestId !== latestEventsRequest) return;
        set({ events: response.data, isLoadingEvents: false });
      } catch (error) {
        if (requestId !== latestEventsRequest) return;
        set({
          isLoadingEvents: false,
          eventsError: error instanceof Error ? error.message : String(error),
        });
      }
    },

    fetchProjects: async () => {
      try {
        const response = await api.get<{ data: ContentProject[] }>(
          `${BASE}/projects`,
        );
        set({ projects: response.data });
      } catch {
        // Non-critical side panel: keep the previous list.
      }
    },

    fetchStats: async () => {
      try {
        const response = await api.get<{ data: ContentPlannerStats }>(
          `${BASE}/stats`,
        );
        set({ stats: response.data });
      } catch {
        // Keep the last known totals.
      }
    },

    fetchCustomTypes: async () => {
      try {
        const response = await api.get<{ data: ContentCustomType[] }>(
          `${BASE}/types`,
        );
        set({ customTypes: response.data });
      } catch {
        // The built-in types still work.
      }
    },

    createCustomType: async (name, color, icon = "tag") => {
      const response = await api.post<{ data: ContentCustomType }>(
        `${BASE}/types`,
        { name, color, icon },
      );
      set((s) => ({ customTypes: [...s.customTypes, response.data] }));
      return response.data;
    },

    deleteCustomType: async (id) => {
      await api.delete(`${BASE}/types/${id}`);
      set((s) => ({
        customTypes: s.customTypes.filter((t) => t.id !== id),
        // Mirrors the API (FK SetNull): its sessions become plain OTHER.
        events: s.events.map((e) =>
          e.customTypeId === id
            ? { ...e, type: "OTHER", customTypeId: null, customType: null }
            : e,
        ),
      }));
      void get().fetchProjects();
    },

    fetchCustomPlatforms: async () => {
      try {
        const response = await api.get<{ data: ContentCustomPlatform[] }>(
          `${BASE}/platforms`,
        );
        set({ customPlatforms: response.data });
      } catch {
        // The built-in platforms still work.
      }
    },

    createCustomPlatform: async (name) => {
      const response = await api.post<{ data: ContentCustomPlatform }>(
        `${BASE}/platforms`,
        { name },
      );
      set((s) => ({ customPlatforms: [...s.customPlatforms, response.data] }));
      return response.data;
    },

    deleteCustomPlatform: async (id) => {
      await api.delete(`${BASE}/platforms/${id}`);
      set((s) => ({
        customPlatforms: s.customPlatforms.filter((p) => p.id !== id),
        // Mirrors the API (FK SetNull): those projects lose their platform.
        projects: s.projects.map((p) =>
          p.customPlatformId === id
            ? { ...p, customPlatformId: null, customPlatform: null }
            : p,
        ),
      }));
    },

    fetchProductionSteps: async () => {
      try {
        const response = await api.get<{ data: SavedProductionStep[] }>(
          `${BASE}/steps`,
        );
        set({ productionSteps: response.data });
      } catch {
        // Fall back to the built-in steps.
        set((s) => ({ productionSteps: s.productionSteps ?? [] }));
      }
    },

    saveProductionSteps: async (steps) => {
      const response = await api.put<{ data: SavedProductionStep[] }>(
        `${BASE}/steps`,
        { steps },
      );
      set({ productionSteps: response.data });
    },

    createEvent: async (input) => {
      const response = await api.post<MutationResult<ContentEvent>>(
        `${BASE}/events`,
        input,
      );
      set((s) => ({ events: [...s.events, response.data].sort(byStart) }));
      if (input.projectId) void get().fetchProjects();
      void get().fetchStats();
      return response.conflicts;
    },

    updateEvent: async (id, patch) => {
      const previous = get().events;
      const current = previous.find((e) => e.id === id);
      // Optimistic: drag & drop and status toggles feel instant.
      if (current) {
        set({
          events: previous
            .map((e) =>
              e.id === id ? ({ ...e, ...patch } as ContentEvent) : e,
            )
            .sort(byStart),
        });
      }
      try {
        const response = await api.patch<MutationResult<ContentEvent>>(
          `${BASE}/events/${id}`,
          patch,
        );
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? response.data : e)),
        }));
        if (current?.projectId || response.data.projectId) {
          void get().fetchProjects();
        }
        void get().fetchStats();
        return response.conflicts;
      } catch (error) {
        set({ events: previous });
        throw error;
      }
    },

    deleteEvent: async (id) => {
      const removed = get().events.find((e) => e.id === id);
      await api.delete(`${BASE}/events/${id}`);
      set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
      if (removed?.projectId) void get().fetchProjects();
      void get().fetchStats();
    },

    createProject: async (input) => {
      const response = await api.post<MutationResult<{ id: string }>>(
        `${BASE}/projects`,
        input,
      );
      await Promise.all([
        get().fetchEvents(),
        get().fetchProjects(),
        get().fetchStats(),
        // Customised steps may have created or restyled custom types.
        get().fetchCustomTypes(),
      ]);
      return { projectId: response.data.id, conflicts: response.conflicts };
    },

    deleteProject: async (id) => {
      await api.delete(`${BASE}/projects/${id}`);
      set((s) => ({
        // Its sessions are deleted by the API (cascade).
        events: s.events.filter((e) => e.projectId !== id),
        projects: s.projects.filter((p) => p.id !== id),
        focusedProjectId: s.focusedProjectId === id ? null : s.focusedProjectId,
      }));
      void get().fetchStats();
    },
  }),
);
