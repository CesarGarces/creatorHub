"use client";

import { useRef, useState, useEffect } from "react";

function parseHSL(hslStr: string) {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return {
    h: parseFloat(match[1] ?? "40"),
    s: parseFloat(match[2] ?? "80"),
    l: parseFloat(match[3] ?? "80"),
  };
}

function buildBoxShadow(glowColor: string, intensity: number) {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const layers = [
    [0, 0, 0, 1, 100, true],
    [0, 0, 1, 0, 60, true],
    [0, 0, 3, 0, 50, true],
    [0, 0, 6, 0, 40, true],
    [0, 0, 15, 0, 30, true],
    [0, 0, 25, 2, 20, true],
    [0, 0, 50, 2, 10, true],
    [0, 0, 1, 0, 60, false],
    [0, 0, 3, 0, 50, false],
    [0, 0, 6, 0, 40, false],
    [0, 0, 15, 0, 30, false],
    [0, 0, 25, 2, 20, false],
    [0, 0, 50, 2, 10, false],
  ];
  return layers
    .map(([x, y, blur, spread, alpha, inset]) => {
      const a = Math.min((alpha as number) * intensity, 100);
      return `${inset ? "inset " : ""}${x}px ${y}px ${blur}px ${spread}px hsl(${base} / ${a}%)`;
    })
    .join(", ");
}

const GRADIENT_POSITIONS = [
  "80% 55%",
  "69% 34%",
  "8% 6%",
  "41% 38%",
  "86% 85%",
  "82% 18%",
  "51% 4%",
];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildMeshGradients(colors: string[]) {
  const gradients = [];
  for (let i = 0; i < 7; i++) {
    const colorIndex = COLOR_MAP[i] ?? 0;
    const c =
      colors[Math.min(colorIndex, colors.length - 1)] ?? colors[0] ?? "#c084fc";
    const pos = GRADIENT_POSITIONS[i] ?? "50% 50%";
    gradients.push(`radial-gradient(at ${pos}, ${c} 0px, transparent 50%)`);
  }
  gradients.push(`linear-gradient(${colors[0] ?? "#c084fc"} 0 100%)`);
  return gradients;
}

interface BorderGlowProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
  speed?: number;
}

export function BorderGlow({
  children,
  className = "",
  glowColor = "40 80 80",
  backgroundColor = "#120F17",
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = false,
  colors = ["#c084fc", "#f472b6", "#38bdf8"],
  fillOpacity = 0.5,
  speed = 1.5,
}: BorderGlowProps) {
  const [angle, setAngle] = useState(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!animated) {
      setAngle(0);
      return;
    }

    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      setAngle((prev) => (prev + (delta * 360) / (speed * 1000)) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [animated, speed]);

  const meshGradients = buildMeshGradients(colors);
  const borderBg = meshGradients.map((g) => `${g} border-box`);
  const fillBg = meshGradients.map((g) => `${g} padding-box`);
  const angleDeg = `${angle.toFixed(3)}deg`;

  return (
    <div
      className={`relative grid isolate border border-white/15 ${className}`}
      style={{
        background: backgroundColor,
        borderRadius: `${borderRadius}px`,
        transform: "translate3d(0, 0, 0.01px)",
        boxShadow:
          "rgba(0,0,0,0.1) 0 1px 2px, rgba(0,0,0,0.1) 0 2px 4px, rgba(0,0,0,0.1) 0 4px 8px, rgba(0,0,0,0.1) 0 8px 16px, rgba(0,0,0,0.1) 0 16px 32px, rgba(0,0,0,0.1) 0 32px 64px",
      }}
    >
      {/* mesh gradient border */}
      <div
        className="absolute inset-0 rounded-[inherit] -z-[1]"
        style={{
          border: "1px solid transparent",
          background: [
            `linear-gradient(${backgroundColor} 0 100%) padding-box`,
            "linear-gradient(rgb(255 255 255 / 0%) 0% 100%) border-box",
            ...borderBg,
          ].join(", "),
          opacity: animated ? 1 : 0,
          maskImage: `conic-gradient(from ${angleDeg} at center, black ${coneSpread}%, transparent ${coneSpread + 15}%, transparent ${100 - coneSpread - 15}%, black ${100 - coneSpread}%)`,
          WebkitMaskImage: `conic-gradient(from ${angleDeg} at center, black ${coneSpread}%, transparent ${coneSpread + 15}%, transparent ${100 - coneSpread - 15}%, black ${100 - coneSpread}%)`,
          transition: "opacity 0.5s ease-out",
        }}
      />

      {/* mesh gradient fill near edges */}
      <div
        className="absolute inset-0 rounded-[inherit] -z-[1]"
        style={{
          border: "1px solid transparent",
          background: fillBg.join(", "),
          maskImage: [
            "linear-gradient(to bottom, black, black)",
            "radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)",
            "radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)",
            "radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)",
            "radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)",
            "radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)",
            `conic-gradient(from ${angleDeg} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
          ].join(", "),
          WebkitMaskImage: [
            "linear-gradient(to bottom, black, black)",
            "radial-gradient(ellipse at 50% 50%, black 40%, transparent 65%)",
            "radial-gradient(ellipse at 66% 66%, black 5%, transparent 40%)",
            "radial-gradient(ellipse at 33% 33%, black 5%, transparent 40%)",
            "radial-gradient(ellipse at 66% 33%, black 5%, transparent 40%)",
            "radial-gradient(ellipse at 33% 66%, black 5%, transparent 40%)",
            `conic-gradient(from ${angleDeg} at center, transparent 5%, black 15%, black 85%, transparent 95%)`,
          ].join(", "),
          maskComposite: "subtract, add, add, add, add, add",
          WebkitMaskComposite:
            "source-out, source-over, source-over, source-over, source-over, source-over",
          opacity: animated ? fillOpacity : 0,
          mixBlendMode: "soft-light",
          transition: "opacity 0.5s ease-out",
        }}
      />

      {/* outer glow */}
      <span
        className="absolute pointer-events-none z-[1] rounded-[inherit]"
        style={{
          inset: `${-glowRadius}px`,
          maskImage: `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
          WebkitMaskImage: `conic-gradient(from ${angleDeg} at center, black 2.5%, transparent 10%, transparent 90%, black 97.5%)`,
          opacity: animated ? 1 : 0,
          mixBlendMode: "plus-lighter",
          transition: "opacity 0.5s ease-out",
        }}
      >
        <span
          className="absolute rounded-[inherit]"
          style={{
            inset: `${glowRadius}px`,
            boxShadow: buildBoxShadow(glowColor, glowIntensity),
          }}
        />
      </span>

      <div className="flex flex-col relative overflow-auto z-[1]">
        {children}
      </div>
    </div>
  );
}
