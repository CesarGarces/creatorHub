"use client";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  colors?: string[];
  speed?: number;
  className?: string;
}

const SIZE_MAP = {
  sm: { width: 140, height: 80, fontSize: "text-xs", padding: "px-3" },
  md: { width: 200, height: 100, fontSize: "text-sm", padding: "px-4" },
  lg: { width: 280, height: 140, fontSize: "text-base", padding: "px-6" },
};

export function LoadingSpinner({
  size = "md",
  text = "Generating...",
  colors = ["#c084fc", "#f472b6", "#38bdf8"],
  speed = 1.5,
  className = "",
}: LoadingSpinnerProps) {
  const dims = SIZE_MAP[size];
  const gradient = colors.join(", ");

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ width: dims.width, height: dims.height }}
      >
        <div
          className="absolute -inset-2 rounded-xl"
          style={{
            background: `conic-gradient(from 0deg, ${gradient})`,
            animation: `spinGlow ${speed}s linear infinite`,
            filter: "blur(6px)",
            opacity: 0.7,
          }}
        />
        <div className="absolute inset-0.5 rounded-xl bg-surface flex items-center justify-center">
          {text && (
            <p
              className={`${dims.fontSize} font-medium text-text-muted text-center ${dims.padding}`}
            >
              {text}
            </p>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spinGlow {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
