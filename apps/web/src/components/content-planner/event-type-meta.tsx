import {
  Calendar,
  Camera,
  Clapperboard,
  Image as ImageIcon,
  Lightbulb,
  Megaphone,
  Mic,
  Music,
  PenLine,
  Radio,
  Scissors,
  Sparkles,
  Tag,
  Upload,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import {
  BUILTIN_LOOKS,
  isPaletteColor,
  isPaletteIcon,
  type Look,
  type PaletteColor,
  type PaletteIcon,
} from "@/lib/content-planner/palette";
import type {
  ContentCustomType,
  ContentEventType,
} from "@/lib/content-planner/types";

interface ColorStyle {
  /** Calendar block: tinted background, colored accent border and text. */
  block: string;
  /** Small color dot (month view, legends, pickers). */
  dot: string;
}

interface TypeStyle extends ColorStyle {
  icon: LucideIcon;
}

// Full class names (no string building) so Tailwind picks them up.
export const COLOR_STYLES: Record<PaletteColor, ColorStyle> = {
  amber: {
    block:
      "bg-amber-500/15 border-amber-400 text-amber-100 hover:bg-amber-500/25",
    dot: "bg-amber-400",
  },
  sky: {
    block: "bg-sky-500/15 border-sky-400 text-sky-100 hover:bg-sky-500/25",
    dot: "bg-sky-400",
  },
  rose: {
    block: "bg-rose-500/15 border-rose-400 text-rose-100 hover:bg-rose-500/25",
    dot: "bg-rose-400",
  },
  violet: {
    block:
      "bg-violet-500/15 border-violet-400 text-violet-100 hover:bg-violet-500/25",
    dot: "bg-violet-400",
  },
  fuchsia: {
    block:
      "bg-fuchsia-500/15 border-fuchsia-400 text-fuchsia-100 hover:bg-fuchsia-500/25",
    dot: "bg-fuchsia-400",
  },
  emerald: {
    block:
      "bg-emerald-500/15 border-emerald-400 text-emerald-100 hover:bg-emerald-500/25",
    dot: "bg-emerald-400",
  },
  red: {
    block: "bg-red-500/15 border-red-400 text-red-100 hover:bg-red-500/25",
    dot: "bg-red-400",
  },
  slate: {
    block:
      "bg-slate-500/15 border-slate-400 text-slate-100 hover:bg-slate-500/25",
    dot: "bg-slate-400",
  },
  teal: {
    block: "bg-teal-500/15 border-teal-400 text-teal-100 hover:bg-teal-500/25",
    dot: "bg-teal-400",
  },
  orange: {
    block:
      "bg-orange-500/15 border-orange-400 text-orange-100 hover:bg-orange-500/25",
    dot: "bg-orange-400",
  },
  lime: {
    block: "bg-lime-500/15 border-lime-400 text-lime-100 hover:bg-lime-500/25",
    dot: "bg-lime-400",
  },
  indigo: {
    block:
      "bg-indigo-500/15 border-indigo-400 text-indigo-100 hover:bg-indigo-500/25",
    dot: "bg-indigo-400",
  },
  cyan: {
    block: "bg-cyan-500/15 border-cyan-400 text-cyan-100 hover:bg-cyan-500/25",
    dot: "bg-cyan-400",
  },
  yellow: {
    block:
      "bg-yellow-500/15 border-yellow-400 text-yellow-100 hover:bg-yellow-500/25",
    dot: "bg-yellow-400",
  },
  pink: {
    block: "bg-pink-500/15 border-pink-400 text-pink-100 hover:bg-pink-500/25",
    dot: "bg-pink-400",
  },
  stone: {
    block:
      "bg-stone-500/15 border-stone-400 text-stone-100 hover:bg-stone-500/25",
    dot: "bg-stone-400",
  },
};

export const ICONS: Record<PaletteIcon, LucideIcon> = {
  lightbulb: Lightbulb,
  pen: PenLine,
  clapperboard: Clapperboard,
  scissors: Scissors,
  image: ImageIcon,
  upload: Upload,
  radio: Radio,
  tag: Tag,
  mic: Mic,
  camera: Camera,
  music: Music,
  megaphone: Megaphone,
  sparkles: Sparkles,
  users: Users,
  calendar: Calendar,
  video: Video,
};

/** Icon + colors for a look (color/icon pair). */
export function lookStyle(look: Look): TypeStyle {
  return { icon: ICONS[look.icon], ...COLOR_STYLES[look.color] };
}

export const EVENT_TYPE_STYLES = Object.fromEntries(
  Object.entries(BUILTIN_LOOKS).map(([type, look]) => [type, lookStyle(look)]),
) as Record<ContentEventType, TypeStyle>;

interface Typed {
  type: ContentEventType;
  customType?: ContentCustomType | null;
}

/** Icon and colors of a session: its custom type wins over the built-in one. */
export function eventStyle(event: Typed): TypeStyle {
  if (event.customType) {
    return lookStyle({
      color: isPaletteColor(event.customType.color)
        ? event.customType.color
        : "stone",
      icon: isPaletteIcon(event.customType.icon)
        ? event.customType.icon
        : "tag",
    });
  }
  return EVENT_TYPE_STYLES[event.type];
}

/** Done / cancelled sessions are de-emphasised everywhere. */
export function statusClasses(status: string): string {
  if (status === "DONE") return "opacity-60";
  if (status === "CANCELLED") return "opacity-40 line-through";
  return "";
}
