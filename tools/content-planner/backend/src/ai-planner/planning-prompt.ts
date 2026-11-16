import {
  CONTENT_EVENT_TYPES,
  CONTENT_PLATFORMS,
  type ContentEventTypeValue,
} from "../content-planner.constants";
import {
  COMPLEXITY_LEVELS,
  type AiPlanStep,
  type AvailableTool,
  type ComplexityLevel,
  type ComplexitySignals,
  type PlanLanguage,
  type SimilarProduction,
} from "./ai-plan.types";

export const PLAN_LIMITS = {
  maxSteps: 12,
  minStepMinutes: 15,
  maxStepMinutes: 720,
  maxPublishInDays: 90,
  nameMax: 40,
  titleMax: 80,
  descriptionMax: 280,
  intentionMax: 200,
  toolPromptMax: 1000,
} as const;

const LANGUAGE_NAMES: Record<PlanLanguage, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
};

/** Words in the brief that point at a platform tool (any UI language). */
const TOOL_KEYWORDS: Record<string, string[]> = {
  "thumbnail-generator": ["thumbnail", "miniatura", "portada", "capa", "cover"],
  "video-generator": [
    "b-roll",
    "broll",
    "animation",
    "animación",
    "animacao",
    "animação",
    "clip",
    "intro video",
    "ai video",
  ],
  "script-writer": [
    "script",
    "guion",
    "guión",
    "roteiro",
    "storyboard",
    "outline",
    "narration",
    "narración",
    "narração",
  ],
  "content-translator": [
    "translate",
    "translation",
    "traducir",
    "traducción",
    "traduzir",
    "tradução",
    "subtitles",
    "subtítulos",
    "legendas",
  ],
  "x-post-tweet": ["tweet", "twitter", "hilo de x", "thread"],
  "x-search-trends": [
    "trend",
    "trending",
    "tendencia",
    "tendência",
    "research",
    "investigar",
    "pesquisar",
  ],
};

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function mentionedTools(text: string, tools: AvailableTool[]): string[] {
  const haystack = text.toLowerCase();
  return tools
    .filter((t) =>
      (TOOL_KEYWORDS[t.id] ?? []).some((k) => haystack.includes(k)),
    )
    .map((t) => t.id);
}

/** 1–5 from the size of the brief, its breadth and past productions. */
export function heuristicComplexity(input: {
  inputWords: number;
  sources: number;
  mentionedTools: number;
  historyAverageMinutes: number | null;
}): number {
  let score = 1;
  if (input.inputWords > 150) score++;
  if (input.inputWords > 600) score++;
  if (input.sources >= 2 || input.mentionedTools >= 2) score++;
  if ((input.historyAverageMinutes ?? 0) > 8 * 60) score++;
  return Math.min(5, score);
}

export function levelForScore(score: number): ComplexityLevel {
  return score <= 2 ? "low" : score === 3 ? "medium" : "high";
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export interface PromptInput {
  language: PlanLanguage;
  idea: string;
  transcript: string;
  /** Document excerpts already selected by retrieval. */
  excerpts: { source: string; text: string }[];
  platform: string | null;
  publishDate: string | null;
  tools: AvailableTool[];
  signals: ComplexitySignals;
  similar: (SimilarProduction & { digest: string })[];
}

/** The whole instruction for the planning model (providers take one prompt). */
export function buildPlanningPrompt(input: PromptInput): string {
  const toolLines = input.tools.length
    ? input.tools
        .map((t) => `  - ${t.id} (${t.name}): ${t.description}`)
        .join("\n")
    : "  (none)";
  const similarLines = input.similar.length
    ? input.similar
        .map(
          (s, i) =>
            `${i + 1}. "${s.title}" (similarity ${s.similarity.toFixed(2)}): ${formatMinutes(s.totalMinutes)} over ${s.sessions} sessions — ${s.digest}`,
        )
        .join("\n")
    : "None yet (first productions of this creator).";
  const s = input.signals;

  return `You are the production-planning assistant of Creator Hub, a platform for video creators.
Analyse the creator's idea and produce a realistic production plan they can schedule.

Respond ONLY with a JSON object (no markdown, no comments) with exactly this shape:
{
  "title": string (video title, max ${PLAN_LIMITS.titleMax} chars),
  "summary": string (1-2 sentences),
  "platform": one of ${JSON.stringify(CONTENT_PLATFORMS)} or null,
  "complexity": { "level": "low" | "medium" | "high", "score": integer 1-5, "rationale": string (max 2 sentences) },
  "suggestedPublishInDays": integer (working days needed before publishing, 1-${PLAN_LIMITS.maxPublishInDays}),
  "steps": [
    {
      "name": string (max ${PLAN_LIMITS.nameMax} chars),
      "type": one of ${JSON.stringify(CONTENT_EVENT_TYPES)},
      "durationMinutes": integer (${PLAN_LIMITS.minStepMinutes}-${PLAN_LIMITS.maxStepMinutes}, multiple of 15),
      "description": string (one sentence: what to do),
      "tool": null or { "toolId": string, "intention": string, "prompt": string }
    }
  ]
}

Rules:
- 3 to 10 steps in production order. When the video is published, the LAST step has type PUBLISHING.
- Durations are realistic hands-on working time for one creator. Calibrate them with the creator's past productions below when there are any.
- Attach a tool only when it clearly helps that step, and only one of these tools:
${toolLines}
- "intention" says why the tool is used; "prompt" is a ready-to-use input for that tool.
- Write every text field in ${LANGUAGE_NAMES[input.language]}.

PRELIMINARY ANALYSIS (computed):
- Brief size: ${s.inputWords} words from ${s.sources} source(s); ${s.excerpts} document excerpt(s) selected.
- Heuristic complexity: ${s.heuristicScore}/5.
- Tools the brief mentions: ${s.mentionedTools.length ? s.mentionedTools.join(", ") : "none"}.
${s.historyAverageMinutes !== null ? `- Similar past productions took ${formatMinutes(s.historyAverageMinutes)} on average.\n` : ""}
CREATOR'S PAST PRODUCTIONS MOST SIMILAR TO THIS IDEA (vector search):
${similarLines}

CREATOR'S BRIEF:
- Preferred platform: ${input.platform ?? "not specified"}
- Target publish date: ${input.publishDate ?? "not specified"}
${input.idea ? `Idea:\n${input.idea}\n` : ""}${input.transcript ? `Voice notes (transcribed):\n${input.transcript}\n` : ""}${input.excerpts.length ? `Documents (most relevant excerpts):\n${input.excerpts.map((e) => `[${e.source}] ${e.text}`).join("\n\n")}\n` : ""}`;
}

export class PlanParseError extends Error {}

/** The JSON object in a model reply (tolerates fences, prose and trailing commas). */
export function extractJsonObject(raw: string): Record<string, unknown> {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const text = fenced ? fenced[1]! : raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start)
    throw new PlanParseError("No JSON object in reply");
  const candidate = text.slice(start, end + 1);
  for (const attempt of [candidate, candidate.replace(/,\s*([}\]])/g, "$1")]) {
    try {
      const parsed: unknown = JSON.parse(attempt);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next repair
    }
  }
  throw new PlanParseError("Reply is not valid JSON");
}

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

const titleCase = (type: string) =>
  type.charAt(0) + type.slice(1).toLowerCase();

function clampMinutes(value: unknown): number {
  const n = Math.round(Number(value) / 15) * 15;
  if (!Number.isFinite(n)) return 60;
  return Math.min(
    PLAN_LIMITS.maxStepMinutes,
    Math.max(PLAN_LIMITS.minStepMinutes, n),
  );
}

export interface ParsedPlan {
  title: string;
  summary: string;
  platform: string | null;
  complexity: { level: ComplexityLevel; score: number; rationale: string };
  suggestedPublishInDays: number;
  steps: AiPlanStep[];
}

/**
 * Turns a model reply into a safe plan: known types only, durations clamped
 * to 15-minute steps, unknown tools dropped, one publishing step (last),
 * unique step names, and fallbacks from the heuristic analysis.
 */
export function parsePlanResponse(
  raw: string,
  ctx: {
    tools: AvailableTool[];
    heuristicScore: number;
    fallbackTitle: string;
  },
): ParsedPlan {
  const data = extractJsonObject(raw);
  const toolsById = new Map(ctx.tools.map((t) => [t.id, t]));

  const rawSteps = Array.isArray(data.steps) ? data.steps : [];
  const steps: AiPlanStep[] = [];
  let publish: AiPlanStep | null = null;
  const names = new Set<string>();

  for (const item of rawSteps) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    const typeRaw = str(s.type, 20).toUpperCase();
    const type: ContentEventTypeValue = (
      CONTENT_EVENT_TYPES as readonly string[]
    ).includes(typeRaw)
      ? (typeRaw as ContentEventTypeValue)
      : "OTHER";

    let name = str(s.name, PLAN_LIMITS.nameMax) || titleCase(type);
    for (let n = 2; names.has(name.toLowerCase()); n++) {
      name = `${str(s.name, PLAN_LIMITS.nameMax - 3) || titleCase(type)} ${n}`;
    }

    const toolRaw =
      s.tool && typeof s.tool === "object"
        ? (s.tool as Record<string, unknown>)
        : null;
    const tool = toolRaw ? toolsById.get(str(toolRaw.toolId, 100)) : undefined;

    const step: AiPlanStep = {
      name,
      type,
      durationMinutes: clampMinutes(s.durationMinutes),
      description: str(s.description, PLAN_LIMITS.descriptionMax),
      isPublish: false,
      toolAction: tool
        ? {
            toolId: tool.id,
            toolName: tool.name,
            intention:
              str(toolRaw!.intention, PLAN_LIMITS.intentionMax) ||
              tool.description.slice(0, PLAN_LIMITS.intentionMax),
            prompt: str(toolRaw!.prompt, PLAN_LIMITS.toolPromptMax),
          }
        : null,
    };

    if (type === "PUBLISHING" && !publish) {
      publish = { ...step, isPublish: true };
    } else if (steps.length < PLAN_LIMITS.maxSteps - 1) {
      steps.push(step);
    } else {
      continue;
    }
    names.add(name.toLowerCase());
  }
  if (publish) steps.push(publish);
  if (steps.length === 0) throw new PlanParseError("The plan has no steps");

  const complexityRaw =
    data.complexity && typeof data.complexity === "object"
      ? (data.complexity as Record<string, unknown>)
      : {};
  const scoreRaw = Math.round(Number(complexityRaw.score));
  const score =
    Number.isFinite(scoreRaw) && scoreRaw >= 1
      ? Math.min(5, scoreRaw)
      : ctx.heuristicScore;
  const levelRaw = str(complexityRaw.level, 10).toLowerCase();
  const level = (COMPLEXITY_LEVELS as readonly string[]).includes(levelRaw)
    ? (levelRaw as ComplexityLevel)
    : levelForScore(score);

  const workSteps = steps.filter((s) => !s.isPublish).length;
  const daysRaw = Math.round(Number(data.suggestedPublishInDays));
  const platformRaw = str(data.platform, 30);

  return {
    title: str(data.title, PLAN_LIMITS.titleMax) || ctx.fallbackTitle,
    summary: str(data.summary, 400),
    platform: (CONTENT_PLATFORMS as readonly string[]).includes(platformRaw)
      ? platformRaw
      : null,
    complexity: { level, score, rationale: str(complexityRaw.rationale, 400) },
    // One work session per day before publishing day, starting tomorrow at
    // the earliest: never fewer days than that, whatever the model says.
    suggestedPublishInDays: Math.min(
      PLAN_LIMITS.maxPublishInDays,
      Math.max(
        workSteps + 1,
        Number.isFinite(daysRaw) && daysRaw >= 1 ? daysRaw : 0,
      ),
    ),
    steps,
  };
}
