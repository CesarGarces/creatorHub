import { describe, expect, it } from "vitest";
import { analysisCost, creditUnitsForFrames } from "../pricing";

describe("pricing", () => {
  it.each([
    [0, 1],
    [1, 1],
    [12, 1],
    [13, 2],
    [24, 2],
    [25, 3],
    [32, 3],
  ])("%i keyframes → %i unit(s)", (frames, units) => {
    expect(creditUnitsForFrames(frames)).toBe(units);
  });

  it("multiplies the model's credit cost by the units", () => {
    expect(analysisCost(4, 8)).toBe(4);
    expect(analysisCost(4, 20)).toBe(8);
    expect(analysisCost(4, 32)).toBe(12);
  });

  it("is free with a 0-credit model and never negative", () => {
    expect(analysisCost(0, 32)).toBe(0);
    expect(analysisCost(-3, 10)).toBe(0);
  });
});
