import {
  DEFAULT_MODEL_SETTINGS,
  type ModelSettings,
} from "@/lib/model-settings";

/**
 * Robotina preferences kept in the browser: the text model settings (the
 * same panel as Post to X / X Trend Research — the voice itself is never a
 * setting) and conversation mode (hands-free: listen again after she
 * speaks).
 */
const STORAGE_KEY = "creator_hub.voice_assistant.prefs";

export interface RobotinaPreferences {
  settings: ModelSettings;
  handsFree: boolean;
}

export const DEFAULT_PREFERENCES: RobotinaPreferences = {
  settings: DEFAULT_MODEL_SETTINGS,
  handsFree: true,
};

/** Any stored value → valid preferences (bad fields fall back to defaults). */
export function normalizePreferences(value: unknown): RobotinaPreferences {
  const raw = (value && typeof value === "object" ? value : {}) as {
    settings?: Partial<Record<keyof ModelSettings, unknown>>;
    handsFree?: unknown;
  };
  const s = raw.settings ?? {};
  const d = DEFAULT_PREFERENCES.settings;
  const number = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
      ? v
      : fallback;
  return {
    settings: {
      model: typeof s.model === "string" && s.model.trim() ? s.model : d.model,
      temperature: number(s.temperature, 0, 1, d.temperature),
      maxTokens: Math.round(number(s.maxTokens, 100, 1000, d.maxTokens)),
    },
    handsFree:
      typeof raw.handsFree === "boolean"
        ? raw.handsFree
        : DEFAULT_PREFERENCES.handsFree,
  };
}

export function readPreferences(): RobotinaPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizePreferences(null);
  }
}

export function writePreferences(prefs: RobotinaPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full or disabled: preferences last for this visit only.
  }
}
