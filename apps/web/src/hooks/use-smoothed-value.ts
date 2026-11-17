"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share of the remaining distance covered per 60 fps frame. 0.25 catches up
 * 95% in ~10 frames (~170 ms): smooth, medium speed, never sluggish.
 */
export const SMOOTHING_PER_FRAME = 0.25;
/** Closer than this, the value lands on the target. */
const EPSILON = 0.005;
const FRAME_MS = 1000 / 60;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A number that glides toward `target` on animation frames (exponential
 * easing, frame-rate independent). `null` resets it; the first non-null
 * target and reduced-motion users get the target at once.
 */
export function useSmoothedValue(
  target: number | null,
  factor = SMOOTHING_PER_FRAME,
): number | null {
  const [value, setValue] = useState<number | null>(target);
  const current = useRef<number | null>(target);

  useEffect(() => {
    if (target === null || current.current === null || prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const from = current.current ?? target;
      const elapsed = Math.max(0, now - last);
      last = now;
      // Same visual speed at 30, 60 or 120 Hz.
      const k = 1 - Math.pow(1 - factor, elapsed / FRAME_MS || 1);
      const diff = target - from;
      const next = Math.abs(diff) <= EPSILON ? target : from + diff * k;
      current.current = next;
      setValue(next);
      if (next !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, factor]);

  return value;
}
