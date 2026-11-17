import { FRAMES_PER_CREDIT_UNIT } from "./video-clipper.constants";

/**
 * Started batches of keyframes: 1–12 frames → 1, 13–24 → 2, 25–32 → 3.
 * The web samples more frames for longer videos, so longer videos cost more.
 */
export function creditUnitsForFrames(frames: number): number {
  return Math.max(1, Math.ceil(Math.max(0, frames) / FRAMES_PER_CREDIT_UNIT));
}

/**
 * Credits for one analysis: the vision model's `creditCost` per unit.
 * A model priced at 0 credits makes the analysis free.
 */
export function analysisCost(modelCreditCost: number, frames: number): number {
  return Math.max(0, modelCreditCost) * creditUnitsForFrames(frames);
}
