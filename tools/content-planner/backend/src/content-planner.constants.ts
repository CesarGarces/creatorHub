/** Values mirror the Prisma enums `ContentEventType` / `ContentEventStatus`. */
export const CONTENT_EVENT_TYPES = [
  "IDEATION",
  "SCRIPTING",
  "RECORDING",
  "EDITING",
  "THUMBNAIL",
  "PUBLISHING",
  "LIVESTREAM",
  "OTHER",
] as const;
export type ContentEventTypeValue = (typeof CONTENT_EVENT_TYPES)[number];

export const CONTENT_EVENT_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;
export type ContentEventStatusValue = (typeof CONTENT_EVENT_STATUSES)[number];

/** Same platform ids the Script Writer uses, plus live streaming. */
export const CONTENT_PLATFORMS = [
  "youtube-long",
  "youtube-short",
  "tiktok",
  "reels",
  "twitch",
  "other",
] as const;

/**
 * Colors custom types and production steps can use. The first eight are the
 * built-in types' colors; the rest are extra choices.
 */
export const PALETTE_COLORS = [
  "amber",
  "sky",
  "rose",
  "violet",
  "fuchsia",
  "emerald",
  "red",
  "slate",
  "teal",
  "orange",
  "lime",
  "indigo",
  "cyan",
  "yellow",
  "pink",
  "stone",
] as const;
export type PaletteColor = (typeof PALETTE_COLORS)[number];
/** @deprecated Kept for compatibility — same list as PALETTE_COLORS. */
export const CUSTOM_TYPE_COLORS = PALETTE_COLORS;
export type CustomTypeColor = PaletteColor;

/** Icons custom types and production steps can use. */
export const PALETTE_ICONS = [
  "lightbulb",
  "pen",
  "clapperboard",
  "scissors",
  "image",
  "upload",
  "radio",
  "tag",
  "mic",
  "camera",
  "music",
  "megaphone",
  "sparkles",
  "users",
  "calendar",
  "video",
] as const;
export type PaletteIcon = (typeof PALETTE_ICONS)[number];

export const LIMITS = {
  titleMaxLength: 120,
  notesMaxLength: 5000,
  /** A single session can't span more than a day. */
  maxEventDurationMs: 24 * 60 * 60 * 1000,
  /** Largest window the calendar may request at once (month view + padding). */
  maxRangeMs: 100 * 24 * 60 * 60 * 1000,
  /** Sessions that can be created together with a project. */
  maxEventsPerProject: 20,
  maxProjectsListed: 200,
  customTypeNameMaxLength: 40,
  maxCustomTypesPerUser: 30,
  customPlatformNameMaxLength: 40,
  maxCustomPlatformsPerUser: 30,
  stepNameMaxLength: 40,
  maxProductionSteps: 20,
  minStepMinutes: 15,
  maxStepMinutes: 720,
  /** How many overlapping sessions are reported back as warnings. */
  maxConflictsReported: 5,
} as const;
