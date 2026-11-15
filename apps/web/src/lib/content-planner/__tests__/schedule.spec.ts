import { describe, expect, it } from "vitest";
import { planProductionSchedule } from "../schedule";
import { defaultSteps, type ProductionStep } from "../steps";

// Friday 6 March 2026, 18:00 local time
const friday = new Date(2026, 2, 6, 18, 0);
const label = (s: ProductionStep) => s.name ?? s.baseType ?? "?";
const describeSession = (s: {
  step: ProductionStep;
  startAt: Date;
  endAt: Date;
}) =>
  `${label(s.step)} ${s.startAt.toDateString()} ${s.startAt.getHours()}:${String(
    s.startAt.getMinutes(),
  ).padStart(
    2,
    "0",
  )}-${s.endAt.getHours()}:${String(s.endAt.getMinutes()).padStart(2, "0")}`;

const plan = (
  steps: ProductionStep[],
  over: Partial<{
    publishAt: Date;
    workStartMinutes: number;
    skipWeekends: boolean;
  }> = {},
) =>
  planProductionSchedule({
    publishAt: friday,
    steps,
    workStartMinutes: 10 * 60,
    skipWeekends: true,
    ...over,
  }).map(describeSession);

describe("planProductionSchedule", () => {
  it("schedules one step per working day backwards from the publish date", () => {
    expect(plan(defaultSteps())).toEqual([
      "IDEATION Fri Feb 27 2026 10:00-11:00",
      "SCRIPTING Mon Mar 02 2026 10:00-12:00",
      "RECORDING Tue Mar 03 2026 10:00-13:00",
      "EDITING Wed Mar 04 2026 10:00-14:00",
      "THUMBNAIL Thu Mar 05 2026 10:00-11:00",
      "PUBLISHING Fri Mar 06 2026 18:00-18:30",
    ]);
  });

  it("uses weekends when allowed", () => {
    expect(
      plan(defaultSteps(), {
        publishAt: new Date(2026, 2, 9, 12, 0), // Monday
        workStartMinutes: 9 * 60 + 30,
        skipWeekends: false,
      }).slice(3, 5),
    ).toEqual([
      "EDITING Sat Mar 07 2026 9:30-13:30",
      "THUMBNAIL Sun Mar 08 2026 9:30-10:30",
    ]);
  });

  it("skips disabled steps and respects custom durations", () => {
    const steps = defaultSteps().map((s) =>
      s.baseType === "RECORDING"
        ? { ...s, durationMinutes: 90 }
        : { ...s, enabled: s.baseType === "EDITING" },
    );
    expect(plan(steps, { workStartMinutes: 14 * 60 })).toEqual([
      "RECORDING Wed Mar 04 2026 14:00-15:30",
      "EDITING Thu Mar 05 2026 14:00-18:00",
    ]);
  });

  it("follows the list order, including steps the user added", () => {
    const [ideation, scripting, , , , publishing] = defaultSteps();
    const voiceover: ProductionStep = {
      ...scripting!,
      key: "vo",
      baseType: null,
      name: "Voiceover",
      durationMinutes: 45,
    };
    // Voiceover dragged before Scripting, the rest removed.
    expect(plan([ideation!, voiceover, scripting!, publishing!])).toEqual([
      "IDEATION Tue Mar 03 2026 10:00-11:00",
      "Voiceover Wed Mar 04 2026 10:00-10:45",
      "SCRIPTING Thu Mar 05 2026 10:00-12:00",
      "PUBLISHING Fri Mar 06 2026 18:00-18:30",
    ]);
  });

  it("puts the publishing step at the publish time wherever it is in the list", () => {
    const steps = defaultSteps();
    const publishing = steps.pop()!;
    expect(plan([publishing, ...steps]).at(-1)).toBe(
      "PUBLISHING Fri Mar 06 2026 18:00-18:30",
    );
  });

  it("returns only the publishing session when it is the sole step", () => {
    const only = defaultSteps().map((s) => ({ ...s, enabled: s.isPublish }));
    const sessions = planProductionSchedule({
      publishAt: friday,
      steps: only,
      workStartMinutes: 600,
      skipWeekends: true,
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startAt).toEqual(friday);
  });
});
