import { describe, expect, it } from "vitest";
import {
  MAX_PARTICLE_DISTANCE,
  ORB_PALETTES,
  RIPPLE_LIFETIME,
  createParticles,
  particlePosition,
  rippleAt,
  seededRandom,
  shouldRipple,
  smoothLevel,
  waveRadius,
} from "../orb";

describe("orb math", () => {
  it("has a palette for every state", () => {
    expect(Object.keys(ORB_PALETTES).sort()).toEqual([
      "idle",
      "listening",
      "speaking",
      "thinking",
    ]);
  });

  it("creates the same particles for the same seed, inside and around the orb", () => {
    expect(createParticles(40, 3)).toEqual(createParticles(40, 3));
    const particles = createParticles(200);
    expect(particles).toHaveLength(200);
    expect(particles.some((p) => p.distance < 1)).toBe(true);
    expect(particles.some((p) => p.distance > 1)).toBe(true);
    for (const p of particles) {
      expect(p.distance).toBeGreaterThanOrEqual(0.2);
      expect(p.distance).toBeLessThanOrEqual(1.75);
    }
  });

  it("keeps floating particles within the canvas, louder pushes them out", () => {
    const particles = createParticles(100);
    for (const p of particles) {
      for (const t of [0, 1.3, 9.7]) {
        const quiet = particlePosition(p, t, "idle", 0);
        const loud = particlePosition(p, t, "speaking", 1);
        // Within the canvas: the orb radius is a quarter of its size.
        expect(Math.hypot(loud.x, loud.y)).toBeLessThanOrEqual(
          MAX_PARTICLE_DISTANCE,
        );
        expect(quiet.alpha).toBeGreaterThanOrEqual(0);
        expect(quiet.alpha).toBeLessThanOrEqual(1);
        expect(loud.size).toBeGreaterThan(quiet.size);
      }
    }
  });

  it("the rim is a calm circle in silence and waves with the voice", () => {
    const spread = (level: number) => {
      const radii = Array.from({ length: 64 }, (_, i) =>
        waveRadius((i / 64) * Math.PI * 2, 2.5, level),
      );
      return Math.max(...radii) - Math.min(...radii);
    };
    expect(spread(0)).toBeLessThan(0.001);
    expect(spread(0.8)).toBeGreaterThan(0.08);
    expect(spread(0.8)).toBeGreaterThan(spread(0.3));
  });

  it("smooths levels: quick rise, slower fall", () => {
    const rise = smoothLevel(0, 1, 50);
    const fall = 1 - smoothLevel(1, 0, 50);
    expect(rise).toBeGreaterThan(fall);
    expect(smoothLevel(0.5, 0.5, 16)).toBe(0.5);
    expect(smoothLevel(0, 1, 10_000)).toBeCloseTo(1);
  });

  it("ripples grow, fade and disappear", () => {
    const ripple = { born: 10, strength: 1 };
    const early = rippleAt(ripple, 10.1)!;
    const late = rippleAt(ripple, 11.2)!;
    expect(late.radius).toBeGreaterThan(early.radius);
    expect(late.alpha).toBeLessThan(early.alpha);
    expect(rippleAt(ripple, 10 + RIPPLE_LIFETIME + 0.01)).toBeNull();
    expect(rippleAt(ripple, 9)).toBeNull();
  });

  it("ripples only on peaks, not too often", () => {
    expect(shouldRipple(0.6, 0.4, 0, 5)).toBe(true);
    expect(shouldRipple(0.2, 0.0, 0, 5)).toBe(false); // too quiet
    expect(shouldRipple(0.6, 0.58, 0, 5)).toBe(false); // no peak
    expect(shouldRipple(0.6, 0.4, 4.9, 5)).toBe(false); // too soon
  });

  it("seeded random stays in [0, 1)", () => {
    const random = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
