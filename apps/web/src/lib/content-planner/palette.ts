import type { ContentEventType } from "./types";

/**
 * Colors and icons for custom types and production steps (mirrors the API's
 * PALETTE_COLORS / PALETTE_ICONS). The first eight colors are the built-in
 * types' colors.
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

export interface Look {
  color: PaletteColor;
  icon: PaletteIcon;
}

/** How each built-in session type looks. */
export const BUILTIN_LOOKS: Record<ContentEventType, Look> = {
  IDEATION: { color: "amber", icon: "lightbulb" },
  SCRIPTING: { color: "sky", icon: "pen" },
  RECORDING: { color: "rose", icon: "clapperboard" },
  EDITING: { color: "violet", icon: "scissors" },
  THUMBNAIL: { color: "fuchsia", icon: "image" },
  PUBLISHING: { color: "emerald", icon: "upload" },
  LIVESTREAM: { color: "red", icon: "radio" },
  OTHER: { color: "slate", icon: "tag" },
};

export const isPaletteColor = (v: unknown): v is PaletteColor =>
  (PALETTE_COLORS as readonly unknown[]).includes(v);
export const isPaletteIcon = (v: unknown): v is PaletteIcon =>
  (PALETTE_ICONS as readonly unknown[]).includes(v);
