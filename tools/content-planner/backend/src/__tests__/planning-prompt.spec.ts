import { describe, expect, it } from "vitest";
import {
  buildPlanningPrompt,
  extractJsonObject,
  formatMinutes,
  heuristicComplexity,
  levelForScore,
  mentionedTools,
  parsePlanResponse,
  PlanParseError,
  PLAN_LIMITS,
} from "../ai-planner/planning-prompt";
import type {
  AvailableTool,
  ComplexitySignals,
} from "../ai-planner/ai-plan.types";

const tools: AvailableTool[] = [
  {
    id: "thumbnail-generator",
    name: "Thumbnail Generator",
    description: "AI thumbnails",
  },
  { id: "script-writer", name: "Script Writer", description: "Video scripts" },
];
const ctx = { tools, heuristicScore: 3, fallbackTitle: "My idea" };
const reply = (data: object) => JSON.stringify(data);

describe("extractJsonObject", () => {
  it("accepts plain JSON, fenced JSON, prose around it and trailing commas", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(
      extractJsonObject('Here you go:\n```json\n{"a":1}\n```\nGood luck'),
    ).toEqual({ a: 1 });
    expect(extractJsonObject('Sure! {"a":[1,2,],} hope it helps')).toEqual({
      a: [1, 2],
    });
  });

  it("rejects replies without a JSON object", () => {
    expect(() => extractJsonObject("I can't help with that")).toThrow(
      PlanParseError,
    );
    expect(() => extractJsonObject("[1,2]")).toThrow(PlanParseError);
    expect(() => extractJsonObject("{not json}")).toThrow(PlanParseError);
  });
});

describe("parsePlanResponse", () => {
  it("normalises a full plan", () => {
    const plan = parsePlanResponse(
      reply({
        title: "  Studio   tour  ",
        summary: "Show the new studio.",
        platform: "youtube-long",
        complexity: { level: "HIGH", score: 4, rationale: "Many shots." },
        suggestedPublishInDays: 6,
        steps: [
          {
            name: "Publish",
            type: "publishing",
            durationMinutes: 30,
            description: "Upload",
          },
          {
            name: "Script",
            type: "SCRIPTING",
            durationMinutes: 100,
            description: "Write it",
            tool: {
              toolId: "script-writer",
              intention: "Draft the script",
              prompt: "Studio tour script",
            },
          },
          {
            name: "Thumb",
            type: "THUMBNAIL",
            durationMinutes: 5,
            tool: { toolId: "hacker-tool", intention: "x", prompt: "y" },
          },
          { name: "Ship it", type: "PUBLISHING", durationMinutes: 9999 },
          { type: "DANCING", durationMinutes: "abc" },
        ],
      }),
      ctx,
    );

    expect(plan).toMatchObject({
      title: "Studio tour",
      platform: "youtube-long",
      complexity: { level: "high", score: 4 },
      suggestedPublishInDays: 6,
    });
    expect(
      plan.steps.map((s) => [s.name, s.type, s.durationMinutes, s.isPublish]),
    ).toEqual([
      ["Script", "SCRIPTING", 105, false], // rounded to 15 minutes
      ["Thumb", "THUMBNAIL", 15, false], // clamped up
      ["Ship it", "PUBLISHING", 720, false], // only the first publishing step publishes
      ["Other", "OTHER", 60, false], // unknown type and duration
      ["Publish", "PUBLISHING", 30, true], // moved last
    ]);
    expect(plan.steps[0]!.toolAction).toEqual({
      toolId: "script-writer",
      toolName: "Script Writer",
      intention: "Draft the script",
      prompt: "Studio tour script",
    });
    expect(plan.steps[1]!.toolAction).toBeNull(); // unknown tool dropped
  });

  it("falls back on missing fields and keeps step names unique", () => {
    const plan = parsePlanResponse(
      reply({
        steps: [
          { name: "Edit", type: "EDITING" },
          { name: "edit", type: "EDITING" },
          { type: "RECORDING" },
        ],
      }),
      ctx,
    );
    expect(plan.title).toBe("My idea");
    expect(plan.platform).toBeNull();
    expect(plan.complexity).toEqual({
      level: "medium",
      score: 3,
      rationale: "",
    });
    expect(plan.suggestedPublishInDays).toBe(4); // 3 work steps + 1
    expect(plan.steps.map((s) => s.name)).toEqual([
      "Edit",
      "edit 2",
      "Recording",
    ]);
  });

  it("caps the number of steps but always keeps the publishing step", () => {
    const steps = Array.from({ length: 20 }, (_, i) => ({
      name: `Step ${i}`,
      type: "OTHER",
    }));
    const plan = parsePlanResponse(
      reply({ steps: [...steps, { name: "Publish", type: "PUBLISHING" }] }),
      ctx,
    );
    expect(plan.steps).toHaveLength(PLAN_LIMITS.maxSteps);
    expect(plan.steps.at(-1)).toMatchObject({
      name: "Publish",
      isPublish: true,
    });
  });

  it("leaves at least one day per work session before publishing", () => {
    const steps = [
      { name: "Script", type: "SCRIPTING" },
      { name: "Film", type: "RECORDING" },
      { name: "Edit", type: "EDITING" },
      { name: "Publish", type: "PUBLISHING" },
    ];
    // Too optimistic: 3 work sessions need 4 days (the first one tomorrow).
    expect(
      parsePlanResponse(reply({ steps, suggestedPublishInDays: 2 }), ctx)
        .suggestedPublishInDays,
    ).toBe(4);
    // A longer, realistic timeframe is kept…
    expect(
      parsePlanResponse(reply({ steps, suggestedPublishInDays: 10 }), ctx)
        .suggestedPublishInDays,
    ).toBe(10);
    // …within the limit.
    expect(
      parsePlanResponse(reply({ steps, suggestedPublishInDays: 500 }), ctx)
        .suggestedPublishInDays,
    ).toBe(PLAN_LIMITS.maxPublishInDays);
  });

  it("rejects a plan without steps", () => {
    expect(() =>
      parsePlanResponse(reply({ title: "x", steps: [] }), ctx),
    ).toThrow(PlanParseError);
  });
});

describe("analysis helpers", () => {
  it("finds tools the brief mentions in any interface language", () => {
    expect(mentionedTools("Necesito una MINIATURA y el guion", tools)).toEqual([
      "thumbnail-generator",
      "script-writer",
    ]);
    expect(mentionedTools("just film it", tools)).toEqual([]);
  });

  it("scores complexity from size, breadth and history", () => {
    expect(
      heuristicComplexity({
        inputWords: 20,
        sources: 1,
        mentionedTools: 0,
        historyAverageMinutes: null,
      }),
    ).toBe(1);
    expect(
      heuristicComplexity({
        inputWords: 700,
        sources: 3,
        mentionedTools: 2,
        historyAverageMinutes: 600,
      }),
    ).toBe(5);
    expect([1, 2, 3, 4, 5].map(levelForScore)).toEqual([
      "low",
      "low",
      "medium",
      "high",
      "high",
    ]);
    expect([45, 120, 690].map(formatMinutes)).toEqual(["45m", "2h", "11h 30m"]);
  });
});

describe("buildPlanningPrompt", () => {
  const signals: ComplexitySignals = {
    inputWords: 120,
    sources: 2,
    excerpts: 1,
    similarProductions: 1,
    historyAverageMinutes: 675,
    mentionedTools: ["thumbnail-generator"],
    heuristicScore: 2,
  };

  it("includes the tools, the RAG evidence, the brief and the answer language", () => {
    const prompt = buildPlanningPrompt({
      language: "es",
      idea: "Tour del estudio",
      transcript: "quiero una miniatura llamativa",
      excerpts: [{ source: "brief.pdf", text: "Grabar el lunes" }],
      platform: "youtube-long",
      publishDate: "2030-03-08T18:00:00.000Z",
      tools,
      signals,
      similar: [
        {
          projectId: "p1",
          title: "Old tour",
          similarity: 0.81,
          totalMinutes: 675,
          sessions: 6,
          digest: 'Video "Old tour"',
        },
      ],
    });

    expect(prompt).toContain(
      "- thumbnail-generator (Thumbnail Generator): AI thumbnails",
    );
    expect(prompt).toContain(
      '1. "Old tour" (similarity 0.81): 11h 15m over 6 sessions',
    );
    expect(prompt).toContain(
      "Similar past productions took 11h 15m on average.",
    );
    expect(prompt).toContain("Heuristic complexity: 2/5.");
    expect(prompt).toContain("Write every text field in Spanish.");
    expect(prompt).toContain("Idea:\nTour del estudio");
    expect(prompt).toContain(
      "Voice notes (transcribed):\nquiero una miniatura llamativa",
    );
    expect(prompt).toContain("[brief.pdf] Grabar el lunes");
    expect(prompt).toContain("Target publish date: 2030-03-08T18:00:00.000Z");
  });

  it("says when there is no history yet", () => {
    const prompt = buildPlanningPrompt({
      language: "en",
      idea: "x",
      transcript: "",
      excerpts: [],
      platform: null,
      publishDate: null,
      tools: [],
      signals: { ...signals, historyAverageMinutes: null },
      similar: [],
    });
    expect(prompt).toContain("None yet (first productions of this creator).");
    expect(prompt).toContain("(none)");
    expect(prompt).not.toContain("Voice notes");
  });
});
