import { describe, expect, it } from "vitest";
import {
  createStep,
  defaultSteps,
  duplicateStepName,
  fromSaved,
  insertStep,
  isCustomized,
  moveStep,
  stepLook,
  stepName,
  toSaved,
  totalMinutes,
  withPublishLast,
} from "../steps";

const builtinName = (type: string) =>
  type.charAt(0) + type.slice(1).toLowerCase();
const names = (steps: ReturnType<typeof defaultSteps>) =>
  steps.map((s) => stepName(s, builtinName as never));

describe("production steps", () => {
  it("starts from the built-in pipeline with publishing last", () => {
    const steps = defaultSteps();
    expect(names(steps)).toEqual([
      "Ideation",
      "Scripting",
      "Recording",
      "Editing",
      "Thumbnail",
      "Publishing",
    ]);
    expect(steps.at(-1)?.isPublish).toBe(true);
    expect(new Set(steps.map((s) => s.key)).size).toBe(6);
    expect(steps.some(isCustomized)).toBe(false);
  });

  it("sums the enabled steps: 60+120+180+240+60+30 = 11h 30m", () => {
    const steps = defaultSteps();
    expect(totalMinutes(steps)).toBe(690);
    steps[3]!.enabled = false; // Editing off
    expect(totalMinutes(steps)).toBe(450);
  });

  it("falls back to the built-in look and marks edited steps as customised", () => {
    const [ideation] = defaultSteps();
    expect(stepLook(ideation!)).toEqual({ color: "amber", icon: "lightbulb" });
    const recolored = { ...ideation!, color: "teal" as const };
    expect(stepLook(recolored)).toEqual({ color: "teal", icon: "lightbulb" });
    expect(isCustomized(recolored)).toBe(true);
    expect(isCustomized({ ...ideation!, name: "Brainstorm" })).toBe(true);
  });

  it("reorders by drag & drop but never moves or passes the publishing step", () => {
    const steps = defaultSteps();
    const key = (i: number) => steps[i]!.key;

    expect(names(moveStep(steps, key(3), key(0)))).toEqual([
      "Editing",
      "Ideation",
      "Scripting",
      "Recording",
      "Thumbnail",
      "Publishing",
    ]);
    expect(names(moveStep(steps, key(0), key(4)))).toEqual([
      "Scripting",
      "Recording",
      "Editing",
      "Thumbnail",
      "Ideation",
      "Publishing",
    ]);
    expect(moveStep(steps, key(5), key(0))).toBe(steps);
    expect(moveStep(steps, key(0), key(5))).toBe(steps);
    expect(moveStep(steps, key(0), "missing")).toBe(steps);
  });

  it("adds new steps before publishing with a unique name and an unused color", () => {
    let steps = defaultSteps();
    const first = createStep(steps, "New step");
    steps = insertStep(steps, first);
    const second = createStep(steps, "New step");
    steps = insertStep(steps, second);

    expect(first.name).toBe("New step");
    expect(second.name).toBe("New step 2");
    // Built-in steps use amber…emerald: the next free palette colors follow.
    expect(first.color).toBe("red");
    expect(second.color).toBe("slate");
    expect(names(steps).slice(-3)).toEqual([
      "New step",
      "New step 2",
      "Publishing",
    ]);
    expect(isCustomized(first)).toBe(true);
  });

  it("detects two customised steps sharing a name, ignoring case", () => {
    const steps = defaultSteps();
    expect(duplicateStepName(steps, builtinName as never)).toBeNull();
    steps.push({ ...createStep(steps, "a"), name: "VOICEOVER" });
    steps.push({ ...createStep(steps, "b"), name: "voiceover" });
    expect(duplicateStepName(steps, builtinName as never)).toBe("voiceover");
    // A disabled copy doesn't count.
    steps[steps.length - 1]!.enabled = false;
    expect(duplicateStepName(steps, builtinName as never)).toBeNull();
  });

  it("round-trips through the API shape and repairs unknown values", () => {
    const steps = insertStep(
      defaultSteps(),
      createStep(defaultSteps(), "Voiceover"),
    );
    const saved = toSaved(steps);
    expect(saved[0]).not.toHaveProperty("key");

    const restored = fromSaved(saved);
    expect(names(restored)).toEqual(names(steps));

    const [publish, ...rest] = saved;
    const odd = fromSaved([
      { ...publish!, isPublish: true },
      { ...rest[0]!, color: "plaid", icon: "rocket" },
    ]);
    expect(odd.at(-1)?.isPublish).toBe(true); // publishing moved last
    expect(odd[0]).toMatchObject({ color: null, icon: null });
  });

  it("keeps publishing last", () => {
    const steps = defaultSteps();
    expect(
      withPublishLast([steps[5]!, steps[0]!]).map((s) => s.baseType),
    ).toEqual(["IDEATION", "PUBLISHING"]);
  });
});
