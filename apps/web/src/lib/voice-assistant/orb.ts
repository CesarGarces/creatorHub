/**
 * The Robotina orb: pure drawing math (no DOM), shared by the canvas
 * component and its tests.
 *
 * A glowing sphere with particles floating around it. When someone speaks
 * — the user (listening) or Robotina (speaking) — the rim ripples with
 * waves driven by the live audio level, and rings spread outward on peaks.
 */

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export interface OrbPalette {
  /** Core gradient, inside → rim. */
  core: [string, string, string];
  glow: string;
  particle: string;
  wave: string;
}

/** Brand cyan + violet; listening leans cyan/teal, speaking magenta. */
export const ORB_PALETTES: Record<OrbState, OrbPalette> = {
  idle: {
    core: ["#7dd3fc", "#6366f1", "#1e1b4b"],
    glow: "rgba(99, 102, 241, 0.45)",
    particle: "196, 181, 253",
    wave: "125, 211, 252",
  },
  listening: {
    core: ["#a5f3fc", "#00bbd9", "#0c4a6e"],
    glow: "rgba(0, 187, 217, 0.55)",
    particle: "165, 243, 252",
    wave: "0, 187, 217",
  },
  thinking: {
    core: ["#c4b5fd", "#8b5cf6", "#2e1065"],
    glow: "rgba(139, 92, 246, 0.5)",
    particle: "221, 214, 254",
    wave: "167, 139, 250",
  },
  speaking: {
    core: ["#f5d0fe", "#d946ef", "#4a044e"],
    glow: "rgba(217, 70, 239, 0.5)",
    particle: "250, 232, 255",
    wave: "232, 121, 249",
  },
};

export interface Particle {
  /** Angle around the centre (radians). */
  angle: number;
  /** Distance from the centre, in orb radii (0.2 – 1.75). */
  distance: number;
  /** Angular speed (radians per second, signed). */
  speed: number;
  /** Radial drift phase and amplitude. */
  phase: number;
  drift: number;
  /** Dot size in orb radii. */
  size: number;
  /** Twinkle phase. */
  twinkle: number;
}

/** Small deterministic PRNG (mulberry32): same particles on every render. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createParticles(count: number, seed = 7): Particle[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => {
    const inside = random() < 0.35;
    return {
      angle: random() * Math.PI * 2,
      distance: inside ? 0.2 + random() * 0.7 : 1.05 + random() * 0.7,
      speed: (random() * 0.5 + 0.12) * (random() < 0.5 ? -1 : 1),
      phase: random() * Math.PI * 2,
      drift: 0.03 + random() * 0.06,
      size: 0.012 + random() * 0.03,
      twinkle: random() * Math.PI * 2,
    };
  });
}

/** How lively each state is (particle speed multiplier). */
export const STATE_ENERGY: Record<OrbState, number> = {
  idle: 0.6,
  listening: 1,
  thinking: 2.2,
  speaking: 1.4,
};

/** Farthest a particle ever gets (orb radii): the canvas is sized for it. */
export const MAX_PARTICLE_DISTANCE = 1.98;

/**
 * Where a particle is at time `t` (seconds), in orb radii from the centre,
 * given the audio `level` (0–1): louder → particles pushed outward a bit,
 * fading out before the edge of the canvas.
 */
export function particlePosition(
  p: Particle,
  t: number,
  state: OrbState,
  level: number,
): { x: number; y: number; alpha: number; size: number } {
  const angle = p.angle + p.speed * t * STATE_ENERGY[state];
  const breathe = Math.sin(t * 0.9 + p.phase) * p.drift;
  const push = p.distance > 1 ? level * 0.15 : level * 0.08;
  const distance = Math.min(MAX_PARTICLE_DISTANCE, p.distance + breathe + push);
  const edgeFade = Math.min(1, (MAX_PARTICLE_DISTANCE - distance) / 0.3 + 0.15);
  const alpha =
    (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.1 + p.twinkle))) *
    (p.distance > 1 ? 0.85 : 0.55) *
    edgeFade;
  let x = Math.cos(angle) * distance;
  let y =
    Math.sin(angle) * distance * 0.92 - Math.sin(t * 0.4 + p.phase) * 0.04;
  const reach = Math.hypot(x, y);
  if (reach > MAX_PARTICLE_DISTANCE) {
    x *= MAX_PARTICLE_DISTANCE / reach;
    y *= MAX_PARTICLE_DISTANCE / reach;
  }
  return {
    x,
    y,
    alpha: Math.max(0, Math.min(1, alpha)),
    size: p.size * (1 + level * 0.8),
  };
}

/**
 * Radius (in orb radii) of the wavy rim at `angle` and time `t`: three
 * travelling sine waves whose height follows the audio level. At level 0
 * the rim is a calm circle that barely breathes.
 */
export function waveRadius(
  angle: number,
  t: number,
  level: number,
  ring = 0,
): number {
  const calm = 0.006 * Math.sin(t * 1.3 + ring);
  const amp = level * (0.11 - ring * 0.025);
  const wave =
    Math.sin(angle * 3 + t * 3.1 + ring * 1.7) * 0.55 +
    Math.sin(angle * 5 - t * 4.3 + ring) * 0.3 +
    Math.sin(angle * 8 + t * 6.7 - ring * 0.9) * 0.15;
  return 1 + ring * 0.07 + calm + amp * wave;
}

/**
 * Smooths a noisy level (fast attack, slow release) so waves rise with a
 * syllable and settle gently.
 */
export function smoothLevel(
  previous: number,
  target: number,
  dtMs: number,
): number {
  const rate = target > previous ? 0.02 : 0.006; // per ms
  const k = 1 - Math.exp(-rate * Math.max(0, dtMs));
  return previous + (target - previous) * k;
}

/** A ripple ring spreading outward after a loud peak. */
export interface Ripple {
  born: number; // seconds
  strength: number; // 0–1
}

export const RIPPLE_LIFETIME = 1.6;

/** Ripple radius (orb radii) and opacity at time `t`, or null when gone. */
export function rippleAt(
  ripple: Ripple,
  t: number,
): { radius: number; alpha: number } | null {
  const age = (t - ripple.born) / RIPPLE_LIFETIME;
  if (age < 0 || age >= 1) return null;
  return {
    radius: 1.02 + age * 0.9,
    alpha: (1 - age) * (1 - age) * 0.6 * ripple.strength,
  };
}

/** Whether a new ripple should start: a peak, and not too soon after the last. */
export function shouldRipple(
  level: number,
  previousLevel: number,
  lastRippleAt: number,
  t: number,
): boolean {
  return (
    level > 0.35 && level - previousLevel > 0.06 && t - lastRippleAt > 0.28
  );
}
