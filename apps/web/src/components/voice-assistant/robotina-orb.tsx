"use client";

import { useEffect, useRef } from "react";
import { cn } from "@creator-hub/ui";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  ORB_PALETTES,
  RIPPLE_LIFETIME,
  createParticles,
  particlePosition,
  rippleAt,
  shouldRipple,
  smoothLevel,
  waveRadius,
  type OrbState,
  type Ripple,
} from "@/lib/voice-assistant/orb";

export interface RobotinaOrbProps {
  state: OrbState;
  /** Live audio level (0–1) of whoever speaks; read every frame. */
  getLevel?: () => number;
  /** Width and height in px (fixed: no layout shift). */
  size?: number;
  className?: string;
}

const TAU = Math.PI * 2;
const WAVE_STEPS = 96;

/**
 * Robotina's orb: a glowing sphere with particles floating around it. When
 * the user talks (listening) or she talks (speaking) its rim turns into
 * waves that follow the voice, and rings spread out on the louder syllables.
 *
 * Canvas 2D, one `requestAnimationFrame` loop that runs only while the orb
 * is on screen and the tab is visible. Reduced motion: particles stand
 * still and the rim only swells with the voice. Decorative (`aria-hidden`):
 * the button around it carries the name and the status.
 */
export function RobotinaOrb({
  state,
  getLevel,
  size = 200,
  className,
}: RobotinaOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const getLevelRef = useRef(getLevel);
  getLevelRef.current = getLevel;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = createParticles(Math.round(28 + size / 5));
    const c = size / 2;
    // Particles reach MAX_PARTICLE_DISTANCE radii: keep them on the canvas.
    const R = size * 0.25;
    const start = performance.now();
    let last = start;
    let level = 0;
    let previous = 0;
    let lastRipple = -10;
    let ripples: Ripple[] = [];
    let raf = 0;
    let onScreen = true;

    const wavePath = (t: number, lvl: number, ring: number) => {
      ctx.beginPath();
      for (let i = 0; i <= WAVE_STEPS; i++) {
        const angle = (i / WAVE_STEPS) * TAU;
        const r = waveRadius(angle, t, lvl, ring) * R;
        const x = c + Math.cos(angle) * r;
        const y = c + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    const draw = (now: number) => {
      const current = stateRef.current;
      const palette = ORB_PALETTES[current];
      const dt = now - last;
      last = now;
      const t = reducedMotion ? 0 : (now - start) / 1000;
      const clock = (now - start) / 1000;

      let target = Math.max(0, Math.min(1, getLevelRef.current?.() ?? 0));
      if (current === "thinking") target = 0.16 + 0.08 * Math.sin(clock * 5);
      if (current === "idle") target = 0;
      level = smoothLevel(level, target, dt);

      if (
        !reducedMotion &&
        (current === "listening" || current === "speaking") &&
        shouldRipple(level, previous, lastRipple, clock)
      ) {
        ripples.push({ born: clock, strength: Math.min(1, level * 1.3) });
        lastRipple = clock;
      }
      previous = level;
      ripples = ripples.filter((r) => clock - r.born < RIPPLE_LIFETIME);

      ctx.clearRect(0, 0, size, size);

      // Halo.
      const halo = ctx.createRadialGradient(c, c, R * 0.5, c, c, R * 1.95);
      halo.addColorStop(0, palette.glow);
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(c, c, R * (1.95 + level * 0.05), 0, TAU);
      ctx.fill();

      // Rings spreading out on loud syllables.
      ctx.lineWidth = 1.5;
      for (const ripple of ripples) {
        const r = rippleAt(ripple, clock);
        if (!r) continue;
        ctx.strokeStyle = `rgba(${palette.wave}, ${r.alpha})`;
        ctx.beginPath();
        ctx.arc(c, c, r.radius * R, 0, TAU);
        ctx.stroke();
      }

      // Outer waves, then the core on top.
      for (let ring = 2; ring >= 1; ring--) {
        wavePath(t, level, ring);
        ctx.strokeStyle = `rgba(${palette.wave}, ${0.18 + level * 0.55 - ring * 0.05})`;
        ctx.lineWidth = 2.2 - ring * 0.5;
        ctx.stroke();
      }

      // Floating particles behind the sphere (outside it).
      const dots = particles.map((p) => particlePosition(p, t, current, level));
      for (const d of dots) {
        if (Math.hypot(d.x, d.y) < 1) continue;
        ctx.fillStyle = `rgba(${palette.particle}, ${d.alpha})`;
        ctx.beginPath();
        ctx.arc(c + d.x * R, c + d.y * R, Math.max(0.6, d.size * R), 0, TAU);
        ctx.fill();
      }

      const core = ctx.createRadialGradient(
        c - R * 0.35,
        c - R * 0.4,
        R * 0.05,
        c,
        c,
        R * 1.1,
      );
      core.addColorStop(0, palette.core[0]);
      core.addColorStop(0.55, palette.core[1]);
      core.addColorStop(1, palette.core[2]);
      wavePath(t, level, 0);
      ctx.fillStyle = core;
      ctx.fill();
      ctx.strokeStyle = `rgba(${palette.wave}, ${0.45 + level * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Thinking: a swirl of light turning inside the sphere.
      if (current === "thinking") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.lineWidth = R * 0.08;
        ctx.lineCap = "round";
        for (let k = 0; k < 3; k++) {
          const a = t * (1.6 + k * 0.5) + (k * TAU) / 3;
          ctx.strokeStyle = `rgba(${palette.particle}, 0.35)`;
          ctx.beginPath();
          ctx.arc(c, c, R * (0.45 + k * 0.15), a, a + 1.1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Sparkles inside the sphere.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const d of dots) {
        if (Math.hypot(d.x, d.y) >= 1) continue;
        ctx.fillStyle = `rgba(255, 255, 255, ${d.alpha * 0.8})`;
        ctx.beginPath();
        ctx.arc(
          c + d.x * R,
          c + d.y * R,
          Math.max(0.5, d.size * R * 0.7),
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.restore();

      // Glossy highlight.
      const gloss = ctx.createRadialGradient(
        c - R * 0.38,
        c - R * 0.45,
        0,
        c - R * 0.38,
        c - R * 0.45,
        R * 0.55,
      );
      gloss.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      gloss.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gloss;
      ctx.beginPath();
      ctx.arc(c - R * 0.38, c - R * 0.45, R * 0.55, 0, TAU);
      ctx.fill();
    };

    const frame = (now: number) => {
      raf = 0;
      if (!onScreen || document.hidden) return;
      draw(now);
      raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      if (!raf && onScreen && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => {
            onScreen = entries.some((entry) => entry.isIntersecting);
            resume();
          });
    observer?.observe(canvas);
    document.addEventListener("visibilitychange", resume);
    draw(performance.now()); // first frame at once (no blank orb)
    resume();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", resume);
    };
  }, [size, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-orb-state={state}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("block select-none", className)}
    />
  );
}
