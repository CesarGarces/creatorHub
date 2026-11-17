import { describe, expect, it } from "vitest";
import { contrastRatio, readableInk, readableOnDark } from "../contrast";

describe("contrast helpers", () => {
  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrastRatio("#ffffff", "#00bbd9")).toBeCloseTo(2.31, 1);
  });

  it("picks the ink that reads better", () => {
    expect(readableInk("#00bbd9")).toBe("#0b0f19");
    expect(readableInk("#1e1b4b")).toBe("#ffffff");
  });

  it("lightens a colour until it meets 4.5:1 on the surface", () => {
    const indigo = readableOnDark("#6366f1");
    expect(contrastRatio(indigo, "#121826")).toBeGreaterThanOrEqual(4.5);
    // Already readable colours are kept.
    expect(readableOnDark("#fde047")).toBe("#fde047");
    // Invalid input is returned untouched.
    expect(readableOnDark("tomato")).toBe("tomato");
  });
});
