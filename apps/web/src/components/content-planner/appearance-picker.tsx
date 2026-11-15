"use client";

import { Check } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import {
  PALETTE_COLORS,
  PALETTE_ICONS,
  type PaletteColor,
  type PaletteIcon,
} from "@/lib/content-planner/palette";
import { COLOR_STYLES, ICONS } from "./event-type-meta";

interface AppearancePickerProps {
  color: PaletteColor;
  icon: PaletteIcon;
  onColorChange: (color: PaletteColor) => void;
  onIconChange: (icon: PaletteIcon) => void;
}

/** Color and icon choosers for custom types and production steps. */
export function AppearancePicker({
  color,
  icon,
  onColorChange,
  onIconChange,
}: AppearancePickerProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-sm font-medium text-text-muted">
          {t("contentPlanner.palette.color")}
        </p>
        <div
          role="radiogroup"
          aria-label={t("contentPlanner.palette.color")}
          className="flex flex-wrap gap-1.5"
        >
          {PALETTE_COLORS.map((c) => {
            const label = t(`contentPlanner.palette.colors.${c}`);
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={label}
                title={label}
                onClick={() => onColorChange(c)}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition",
                  COLOR_STYLES[c].dot,
                  color === c ? "ring-2 ring-text" : "hover:scale-110",
                )}
              >
                {color === c && <Check className="h-3 w-3 text-bg" />}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-text-muted">
          {t("contentPlanner.palette.icon")}
        </p>
        <div
          role="radiogroup"
          aria-label={t("contentPlanner.palette.icon")}
          className="flex flex-wrap gap-1"
        >
          {PALETTE_ICONS.map((i) => {
            const Icon = ICONS[i];
            const label = t(`contentPlanner.palette.icons.${i}`);
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={icon === i}
                aria-label={label}
                title={label}
                onClick={() => onIconChange(i)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
                  icon === i
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-transparent text-text-muted hover:bg-surface-elevated hover:text-text",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
