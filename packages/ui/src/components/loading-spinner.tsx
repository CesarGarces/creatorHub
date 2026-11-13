"use client";

import { BorderGlow } from "./border-glow";
import { useUiLabels } from "../lib/labels";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  colors?: string[];
  speed?: number;
  className?: string;
}

const SIZE_MAP = {
  sm: {
    width: 160,
    height: 90,
    fontSize: "text-xs",
    padding: "px-3 py-4",
    borderRadius: 16,
  },
  md: {
    width: 220,
    height: 110,
    fontSize: "text-sm",
    padding: "px-5 py-5",
    borderRadius: 20,
  },
  lg: {
    width: 300,
    height: 150,
    fontSize: "text-base",
    padding: "px-7 py-7",
    borderRadius: 24,
  },
};

export function LoadingSpinner({
  size = "md",
  text,
  colors = ["#c084fc", "#f472b6", "#38bdf8"],
  speed = 1.5,
  className = "",
}: LoadingSpinnerProps) {
  const labels = useUiLabels();
  const dims = SIZE_MAP[size];
  // `text=""` hides the label; omitting it shows the localized default.
  const label = text ?? labels.generating;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <BorderGlow
        animated
        colors={colors}
        backgroundColor="#120F17"
        borderRadius={dims.borderRadius}
        glowColor="40 80 80"
        glowIntensity={2.3}
        glowRadius={63}
        coneSpread={36}
        speed={speed}
      >
        <div
          className="flex items-center justify-center"
          style={{ width: dims.width, height: dims.height }}
        >
          {label && (
            <p
              className={`${dims.fontSize} font-medium text-text-muted text-center ${dims.padding}`}
            >
              {label}
            </p>
          )}
        </div>
      </BorderGlow>
    </div>
  );
}
