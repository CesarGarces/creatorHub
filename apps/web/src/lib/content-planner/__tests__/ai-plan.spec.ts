import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cookie", () => ({ getAccessToken: vi.fn(() => "tok-1") }));

import { getAccessToken } from "@/lib/cookie";
import {
  MAX_PLAN_FILES,
  MAX_PLAN_FILE_BYTES,
  aiPlanToSteps,
  parseSseChunk,
  streamAiPlan,
  suggestedPublishDate,
  toolUrl,
  validatePlanFiles,
  type AiPlanResult,
  type AiPlanStep,
  type PlanningEvent,
} from "../ai-plan";
import { plannedEventsFor, toSaved, type ProductionStep } from "../steps";
import type { ContentEventType } from "../types";

const file = (name: string, size = 10) => {
  const f = new File(["x"], name);
  Object.defineProperty(f, "size", { value: size });
  return f;
};

const BUILTIN: Record<string, string> = {
  IDEATION: "Ideation",
  SCRIPTING: "Scripting",
  RECORDING: "Recording",
  EDITING: "Editing",
  THUMBNAIL: "Thumbnail",
  PUBLISHING: "Publishing",
  OTHER: "Other",
};
const builtinName = (type: ContentEventType) => BUILTIN[type] ?? type;

function plan(steps: AiPlanStep[]): AiPlanResult {
  return {
    title: "Sourdough 101",
    summary: "",
    platform: "youtube",
    complexity: { level: "medium", score: 3, rationale: "" },
    signals: {
      inputWords: 10,
      sources: 0,
      excerpts: 0,
      similarProductions: 0,
      historyAverageMinutes: null,
      mentionedTools: [],
      heuristicScore: 2,
    },
    steps,
    totalMinutes: steps.reduce((s, x) => s + x.durationMinutes, 0),
    suggestedPublishInDays: 4,
    historyEstimateMinutes: null,
    similarProductions: [],
    sources: [],
    model: { id: "m1", name: "Model" },
    embeddingModel: "local:hash-v1",
  };
}

// ─── validatePlanFiles ──────────────────────────────────────────────

describe("validatePlanFiles", () => {
  it("accepts the supported document types (any letter case)", () => {
    const files = ["a.pdf", "b.DOCX", "c.txt", "d.json", "e.md"].map((n) =>
      file(n),
    );
    const { accepted, rejected } = validatePlanFiles([], files);
    expect(accepted).toHaveLength(5);
    expect(rejected).toEqual([]);
  });

  it("rejects other types, big files, duplicates and extra files", () => {
    const current = [file("notes.md"), file("a.txt"), file("b.txt")];
    const { accepted, rejected } = validatePlanFiles(current, [
      file("photo.png"),
      file("noext"),
      file("huge.pdf", MAX_PLAN_FILE_BYTES + 1),
      file("NOTES.md"),
      file("c.txt"),
      file("d.txt"),
      file("e.txt"),
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["c.txt", "d.txt"]);
    expect(rejected.map((r) => [r.file.name, r.problem])).toEqual([
      ["photo.png", "type"],
      ["noext", "type"],
      ["huge.pdf", "size"],
      ["NOTES.md", "duplicate"],
      ["e.txt", "count"],
    ]);
    expect(current.length + accepted.length).toBe(MAX_PLAN_FILES);
  });

  it("accepts a file of exactly the size limit", () => {
    const { accepted } = validatePlanFiles(
      [],
      [file("max.pdf", MAX_PLAN_FILE_BYTES)],
    );
    expect(accepted).toHaveLength(1);
  });
});

// ─── parseSseChunk ──────────────────────────────────────────────────

describe("parseSseChunk", () => {
  it("parses complete events and keeps the partial rest", () => {
    const { events, rest } = parseSseChunk(
      'data: {"type":"stage","stage":"reading"}\n\ndata: {"type":"stage","stage":"index',
    );
    expect(events).toEqual([{ type: "stage", stage: "reading" }]);
    expect(rest).toBe('data: {"type":"stage","stage":"index');
  });

  it("joins multi-line data and skips comments, blanks and bad JSON", () => {
    const { events, rest } = parseSseChunk(
      ': keep-alive\n\ndata: {"type":"error",\ndata: "error":"boom"}\n\ndata: not json\n\n\n\n',
    );
    expect(events).toEqual([{ type: "error", error: "boom" }]);
    expect(rest).toBe("");
  });
});

// ─── streamAiPlan ───────────────────────────────────────────────────

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("streamAiPlan", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const request = {
    model: "model-1",
    idea: "  A video about sourdough  ",
    transcript: "",
    platform: "youtube",
    publishDate: "2030-03-08T18:00:00.000Z",
    language: "es",
    files: [file("brief.md")],
  };
  const donePlan = plan([]);

  it("posts a multipart form with auth and reports every event", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"stage","stage":"reading"}\n\n',
        'data: {"type":"stage","sta',
        'ge":"analyzing"}\n\n',
        `data: ${JSON.stringify({ type: "done", planId: "p1", plan: donePlan, creditsCharged: 3 })}\n\n`,
      ]),
    );
    const seen: PlanningEvent[] = [];
    const done = await streamAiPlan(request, (e) => seen.push(e));

    expect(done).toMatchObject({ planId: "p1", creditsCharged: 3 });
    expect(seen.map((e) => (e.type === "stage" ? e.stage : e.type))).toEqual([
      "reading",
      "analyzing",
      "done",
    ]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/tools\/content-planner\/ai-plans$/);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: "Bearer tok-1" });
    const form = init.body as FormData;
    expect(form.get("model")).toBe("model-1");
    expect(form.get("idea")).toBe("A video about sourdough");
    expect(form.has("transcript")).toBe(false);
    expect(form.get("platform")).toBe("youtube");
    expect(form.get("publishDate")).toBe("2030-03-08T18:00:00.000Z");
    expect(form.get("language")).toBe("es");
    expect((form.getAll("files") as File[]).map((f) => f.name)).toEqual([
      "brief.md",
    ]);
  });

  it("handles a final event without the trailing blank line", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `data: ${JSON.stringify({ type: "done", planId: "p2", plan: donePlan, creditsCharged: 0 })}`,
      ]),
    );
    await expect(streamAiPlan(request, () => {})).resolves.toMatchObject({
      planId: "p2",
    });
  });

  it("sends no Authorization header without a token", async () => {
    vi.mocked(getAccessToken).mockReturnValueOnce(null);
    fetchMock.mockResolvedValue(
      sseResponse([
        `data: ${JSON.stringify({ type: "done", planId: "p3", plan: donePlan, creditsCharged: 1 })}\n\n`,
      ]),
    );
    await streamAiPlan(request, () => {});
    expect(fetchMock.mock.calls[0]![1].headers).toEqual({});
  });

  it("rejects with the API message on HTTP errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Insufficient credits" }), {
        status: 402,
      }),
    );
    await expect(streamAiPlan(request, () => {})).rejects.toThrow(
      "Insufficient credits",
    );

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: ["idea must be shorter"] }), {
        status: 400,
      }),
    );
    await expect(streamAiPlan(request, () => {})).rejects.toThrow(
      "idea must be shorter",
    );

    fetchMock.mockResolvedValue(new Response("oops", { status: 500 }));
    await expect(streamAiPlan(request, () => {})).rejects.toThrow(
      "Request failed (500)",
    );
  });

  it("rejects with a streamed error after reporting it", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"stage","stage":"reading"}\n\n',
        'data: {"type":"error","status":402,"error":"Insufficient credits"}\n\n',
      ]),
    );
    const seen: PlanningEvent[] = [];
    await expect(streamAiPlan(request, (e) => seen.push(e))).rejects.toThrow(
      "Insufficient credits",
    );
    expect(seen.at(-1)).toMatchObject({ type: "error", status: 402 });
  });

  it("rejects when the stream ends without a result", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"type":"stage","stage":"reading"}\n\n']),
    );
    await expect(streamAiPlan(request, () => {})).rejects.toThrow(
      "Planning ended unexpectedly",
    );
  });

  it("passes the abort signal to fetch", async () => {
    const controller = new AbortController();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));
    controller.abort();
    await expect(
      streamAiPlan(request, () => {}, controller.signal),
    ).rejects.toThrow("aborted");
    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
  });
});

// ─── aiPlanToSteps → plannedEventsFor ───────────────────────────────

const aiStep = (over: Partial<AiPlanStep>): AiPlanStep => ({
  name: "Step",
  type: "OTHER",
  durationMinutes: 30,
  description: "",
  isPublish: false,
  toolAction: null,
  ...over,
});

describe("aiPlanToSteps", () => {
  it("keeps built-in names as built-in steps and others as custom", () => {
    const steps = aiPlanToSteps(
      plan([
        aiStep({ name: "Scripting", type: "SCRIPTING", durationMinutes: 60 }),
        aiStep({ name: "recording", type: "RECORDING" }),
        aiStep({ name: " B-roll hunt ", type: "RECORDING" }),
        aiStep({ name: "Mystery", type: "WEIRD" as ContentEventType }),
        aiStep({ name: "Publishing", type: "PUBLISHING", isPublish: true }),
      ]),
      builtinName,
    );
    expect(
      steps.map((s) => [s.baseType, s.name, s.durationMinutes, s.isPublish]),
    ).toEqual([
      ["SCRIPTING", null, 60, false],
      ["RECORDING", null, 30, false],
      ["RECORDING", "B-roll hunt", 30, false],
      ["OTHER", "Mystery", 30, false],
      ["PUBLISHING", null, 30, true],
    ]);
    expect(new Set(steps.map((s) => s.key)).size).toBe(5);
    expect(steps.every((s) => s.enabled)).toBe(true);
  });

  it("keeps the tool action without the display name", () => {
    const [step] = aiPlanToSteps(
      plan([
        aiStep({
          name: "Scripting",
          type: "SCRIPTING",
          toolAction: {
            toolId: "script-writer",
            toolName: "Script Writer",
            intention: "Draft the script",
            prompt: "Write a 5 minute script",
          },
        }),
      ]),
      builtinName,
    );
    expect(step!.toolAction).toEqual({
      toolId: "script-writer",
      intention: "Draft the script",
      prompt: "Write a 5 minute script",
    });
  });

  it("flows into calendar events with tool actions, and is not saved as a template", () => {
    const steps = aiPlanToSteps(
      plan([
        aiStep({
          name: "Thumbnail",
          type: "THUMBNAIL",
          toolAction: {
            toolId: "thumbnail-generator",
            toolName: "Thumbnails",
            intention: "Make a thumbnail",
            prompt: "Bread close-up",
          },
        }),
        aiStep({ name: "Taste test", type: "RECORDING" }),
      ]),
      builtinName,
    );
    const start = new Date("2030-03-04T09:00:00Z");
    const end = new Date("2030-03-04T09:30:00Z");
    const events = plannedEventsFor(
      steps.map((step) => ({ step, startAt: start, endAt: end })),
      {
        sessionTitle: (s: ProductionStep) => `Bread · ${s.name ?? s.baseType}`,
        builtinName,
        reminderMinutes: 15,
      },
    );
    expect(events[0]).toMatchObject({
      type: "THUMBNAIL",
      reminderMinutes: 15,
      toolAction: {
        toolId: "thumbnail-generator",
        intention: "Make a thumbnail",
        prompt: "Bread close-up",
      },
    });
    expect(events[0]).not.toHaveProperty("customType");
    expect(events[1]).toMatchObject({
      type: "RECORDING",
      customType: { name: "Taste test" },
    });
    expect(events[1]).not.toHaveProperty("toolAction");

    for (const saved of toSaved(steps)) {
      expect(saved).not.toHaveProperty("toolAction");
      expect(saved).not.toHaveProperty("key");
    }
  });
});

// ─── suggestedPublishDate / toolUrl ────────────────────────────────

describe("suggestedPublishDate", () => {
  const friday = new Date(2030, 2, 8, 10, 30); // Fri 8 Mar 2030

  it("counts working days, skipping weekends, and lands at 18:00", () => {
    const date = suggestedPublishDate(2, true, friday);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2030, 2, 12,
    ]); // Tue
    expect([date.getHours(), date.getMinutes()]).toEqual([18, 0]);
  });

  it("counts calendar days when weekends are allowed", () => {
    expect(suggestedPublishDate(2, false, friday).getDate()).toBe(10); // Sun
  });

  it("is at least one day ahead", () => {
    expect(suggestedPublishDate(0, false, friday).getDate()).toBe(9);
    expect(suggestedPublishDate(-3, false, friday).getDate()).toBe(9);
  });
});

describe("toolUrl", () => {
  it("opens the tool with the prompt prefilled", () => {
    expect(
      toolUrl({
        toolId: "script-writer",
        intention: "x",
        prompt: "Bread & butter? 100%",
      }),
    ).toBe("/tools/script-writer?prompt=Bread%20%26%20butter%3F%20100%25");
  });

  it("opens the tool alone without a prompt, escaping the id", () => {
    expect(toolUrl({ toolId: "a b", intention: "x", prompt: "" })).toBe(
      "/tools/a%20b",
    );
  });
});
