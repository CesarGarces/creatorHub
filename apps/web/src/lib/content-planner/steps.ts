import {
  BUILTIN_LOOKS,
  PALETTE_COLORS,
  isPaletteColor,
  isPaletteIcon,
  type Look,
  type PaletteColor,
  type PaletteIcon,
} from "./palette";
import type { ContentEventType, PlannedEventInput, ToolAction } from "./types";

/** Limits shared with the API. */
export const MAX_STEPS = 20;
export const STEP_NAME_MAX = 40;
export const MIN_STEP_MINUTES = 15;
export const MAX_STEP_MINUTES = 720;

/**
 * One production step of "Plan a video". Built-in steps keep `name`,
 * `color` and `icon` null until the user changes them, so their name stays
 * translated and their sessions keep the built-in type.
 */
export interface ProductionStep {
  /** Client-side id (drag & drop, React keys). Not stored. */
  key: string;
  baseType: ContentEventType | null;
  name: string | null;
  color: PaletteColor | null;
  icon: PaletteIcon | null;
  durationMinutes: number;
  enabled: boolean;
  /** Happens at the publish date/time instead of on a day before it. */
  isPublish: boolean;
  /** Tool suggested for this step (AI plans); becomes the session's. */
  toolAction?: ToolAction | null;
}

/** The API's shape (GET/PUT /steps). */
export type SavedProductionStep = Omit<
  ProductionStep,
  "key" | "color" | "icon" | "toolAction"
> & {
  id?: string;
  color: string | null;
  icon: string | null;
};

let counter = 0;
export const newStepKey = () => `step-${Date.now().toString(36)}-${++counter}`;

const builtin = (
  type: ContentEventType,
  durationMinutes: number,
  isPublish = false,
): ProductionStep => ({
  key: newStepKey(),
  baseType: type,
  name: null,
  color: null,
  icon: null,
  durationMinutes,
  enabled: true,
  isPublish,
});

/** A video's production pipeline, in order. */
export function defaultSteps(): ProductionStep[] {
  return [
    builtin("IDEATION", 60),
    builtin("SCRIPTING", 120),
    builtin("RECORDING", 180),
    builtin("EDITING", 240),
    builtin("THUMBNAIL", 60),
    builtin("PUBLISHING", 30, true),
  ];
}

/** Effective color and icon of a step. */
export function stepLook(step: ProductionStep): Look {
  const base = BUILTIN_LOOKS[step.baseType ?? "OTHER"];
  return { color: step.color ?? base.color, icon: step.icon ?? base.icon };
}

/** Effective name; `builtinName` translates the built-in type. */
export function stepName(
  step: ProductionStep,
  builtinName: (type: ContentEventType) => string,
): string {
  return step.name ?? builtinName(step.baseType ?? "OTHER");
}

/** Added or edited steps are scheduled with a custom type carrying their look. */
export function isCustomized(step: ProductionStep): boolean {
  return (
    step.baseType === null ||
    step.name !== null ||
    step.color !== null ||
    step.icon !== null
  );
}

/** Minutes of all enabled steps. */
export function totalMinutes(steps: ProductionStep[]): number {
  return steps.reduce(
    (sum, s) => (s.enabled ? sum + s.durationMinutes : sum),
    0,
  );
}

/** Publishing steps are always listed (and scheduled) last. */
export function withPublishLast(steps: ProductionStep[]): ProductionStep[] {
  return [
    ...steps.filter((s) => !s.isPublish),
    ...steps.filter((s) => s.isPublish),
  ];
}

/**
 * Drag & drop: moves `activeKey` to the position of `overKey`. The
 * publishing step is pinned to the end and can't be moved or passed.
 */
export function moveStep(
  steps: ProductionStep[],
  activeKey: string,
  overKey: string,
): ProductionStep[] {
  const from = steps.findIndex((s) => s.key === activeKey);
  const to = steps.findIndex((s) => s.key === overKey);
  if (from === -1 || to === -1 || from === to) return steps;
  if (steps[from]!.isPublish || steps[to]!.isPublish) return steps;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** A new step the user added: named, not yet used color, before publishing. */
export function createStep(
  steps: ProductionStep[],
  baseName: string,
): ProductionStep {
  const used = new Set(steps.map((s) => stepLook(s).color));
  const names = new Set(steps.map((s) => s.name?.toLowerCase()));
  let name = baseName;
  for (let n = 2; names.has(name.toLowerCase()); n++) name = `${baseName} ${n}`;
  return {
    key: newStepKey(),
    baseType: null,
    name,
    color: PALETTE_COLORS.find((c) => !used.has(c)) ?? "slate",
    icon: "tag",
    durationMinutes: 60,
    enabled: true,
    isPublish: false,
  };
}

/** Inserts a step before the publishing step. */
export function insertStep(
  steps: ProductionStep[],
  step: ProductionStep,
): ProductionStep[] {
  const publishAt = steps.findIndex((s) => s.isPublish);
  if (publishAt === -1) return [...steps, step];
  return [...steps.slice(0, publishAt), step, ...steps.slice(publishAt)];
}

/** The reusable template: tool actions belong to one plan, not to it. */
export function toSaved(steps: ProductionStep[]): SavedProductionStep[] {
  return steps.map(({ key: _key, toolAction: _toolAction, ...rest }) => rest);
}

/** From the API; unknown colors/icons fall back to the built-in look. */
export function fromSaved(saved: SavedProductionStep[]): ProductionStep[] {
  return withPublishLast(
    saved.map((s) => ({
      key: newStepKey(),
      baseType: s.baseType,
      name: s.name,
      color: isPaletteColor(s.color) ? s.color : null,
      icon: isPaletteIcon(s.icon) ? s.icon : null,
      durationMinutes: s.durationMinutes,
      enabled: s.enabled,
      isPublish: s.isPublish,
    })),
  );
}

/**
 * Customised steps become custom types named after the step, so two of them
 * can't share a name. Returns the first repeated name, if any.
 */
export function duplicateStepName(
  steps: ProductionStep[],
  builtinName: (type: ContentEventType) => string,
): string | null {
  const seen = new Set<string>();
  for (const step of steps) {
    if (!step.enabled || !isCustomized(step)) continue;
    const name = stepName(step, builtinName).trim();
    const key = name.toLowerCase();
    if (seen.has(key)) return name;
    seen.add(key);
  }
  return null;
}

/**
 * Session payloads for a scheduled plan: built-in steps keep their type,
 * customised ones carry their look (a custom type), and AI-suggested tools
 * travel with their session.
 */
export function plannedEventsFor(
  sessions: { step: ProductionStep; startAt: Date; endAt: Date }[],
  options: {
    sessionTitle: (step: ProductionStep) => string;
    builtinName: (type: ContentEventType) => string;
    reminderMinutes: number | null;
  },
): PlannedEventInput[] {
  return sessions.map(({ step, startAt, endAt }) => {
    const look = stepLook(step);
    return {
      title: options.sessionTitle(step),
      type: step.baseType ?? "OTHER",
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      reminderMinutes: options.reminderMinutes,
      ...(isCustomized(step)
        ? {
            customType: {
              name: stepName(step, options.builtinName).trim(),
              color: look.color,
              icon: look.icon,
            },
          }
        : {}),
      ...(step.toolAction ? { toolAction: step.toolAction } : {}),
    };
  });
}
