import { getAccessToken } from "@/lib/cookie";
import { addDays, isWeekend, startOfDay } from "./dates";
import { newStepKey, type ProductionStep } from "./steps";
import {
  CONTENT_EVENT_TYPES,
  type ContentEventType,
  type ToolAction,
} from "./types";

// ─── Types (mirror the API's AiPlanResult) ───────────────────────────

export type ComplexityLevel = "low" | "medium" | "high";

export interface AiPlanToolAction extends ToolAction {
  toolName: string;
}

export interface AiPlanStep {
  name: string;
  type: ContentEventType;
  durationMinutes: number;
  description: string;
  isPublish: boolean;
  toolAction: AiPlanToolAction | null;
}

export interface SimilarProduction {
  projectId: string;
  title: string;
  similarity: number;
  totalMinutes: number;
  sessions: number;
}

export interface AiPlanResult {
  title: string;
  summary: string;
  platform: string | null;
  complexity: { level: ComplexityLevel; score: number; rationale: string };
  signals: {
    inputWords: number;
    sources: number;
    excerpts: number;
    similarProductions: number;
    historyAverageMinutes: number | null;
    mentionedTools: string[];
    heuristicScore: number;
  };
  steps: AiPlanStep[];
  totalMinutes: number;
  suggestedPublishInDays: number;
  historyEstimateMinutes: number | null;
  similarProductions: SimilarProduction[];
  sources: { name: string; kind: string; chars: number; truncated: boolean }[];
  model: { id: string; name: string };
  embeddingModel: string;
}

export interface PlanEstimate {
  modelId: string;
  modelName: string;
  modelCost: number;
  embeddingModel: string;
  embeddingCost: number;
  total: number;
}

export type PlanningStage =
  | "reading"
  | "indexing"
  | "retrieving"
  | "analyzing"
  | "saving";
export const PLANNING_STAGES: PlanningStage[] = [
  "reading",
  "indexing",
  "retrieving",
  "analyzing",
  "saving",
];

export type PlanningEvent =
  | { type: "stage"; stage: PlanningStage }
  | { type: "done"; planId: string; plan: AiPlanResult; creditsCharged: number }
  | { type: "error"; status?: number; error: string };

// ─── Files ───────────────────────────────────────────────────────────

export const PLAN_FILE_EXTENSIONS = [".pdf", ".docx", ".txt", ".json", ".md"];
export const MAX_PLAN_FILES = 5;
export const MAX_PLAN_FILE_BYTES = 5 * 1024 * 1024;

export type PlanFileProblem = "type" | "size" | "count" | "duplicate";

/**
 * Which files can be added (same rules as the API), and why the others
 * can't — checked before uploading anything.
 */
export function validatePlanFiles(
  current: File[],
  incoming: File[],
): { accepted: File[]; rejected: { file: File; problem: PlanFileProblem }[] } {
  const accepted: File[] = [];
  const rejected: { file: File; problem: PlanFileProblem }[] = [];
  const names = new Set(current.map((f) => f.name.toLowerCase()));
  for (const file of incoming) {
    const ext = /\.[^.]+$/.exec(file.name.toLowerCase())?.[0] ?? "";
    if (!PLAN_FILE_EXTENSIONS.includes(ext)) {
      rejected.push({ file, problem: "type" });
    } else if (file.size > MAX_PLAN_FILE_BYTES) {
      rejected.push({ file, problem: "size" });
    } else if (names.has(file.name.toLowerCase())) {
      rejected.push({ file, problem: "duplicate" });
    } else if (current.length + accepted.length >= MAX_PLAN_FILES) {
      rejected.push({ file, problem: "count" });
    } else {
      accepted.push(file);
      names.add(file.name.toLowerCase());
    }
  }
  return { accepted, rejected };
}

// ─── Streaming (SSE over a multipart POST) ──────────────────────────

/** Parses complete `data: …` events from a buffer; returns the unparsed rest. */
export function parseSseChunk(buffer: string): {
  events: PlanningEvent[];
  rest: string;
} {
  const events: PlanningEvent[] = [];
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      events.push(JSON.parse(data) as PlanningEvent);
    } catch {
      // ignore malformed events
    }
  }
  return { events, rest };
}

export interface AnalyzeRequest {
  model: string;
  idea: string;
  transcript: string;
  platform?: string;
  publishDate?: string;
  language: string;
  files: File[];
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

/**
 * Runs the AI planner and calls `onEvent` for each progress event. Errors
 * (HTTP or streamed) reject with the server's message.
 */
export async function streamAiPlan(
  request: AnalyzeRequest,
  onEvent: (event: PlanningEvent) => void,
  signal?: AbortSignal,
): Promise<Extract<PlanningEvent, { type: "done" }>> {
  const form = new FormData();
  form.set("model", request.model);
  if (request.idea.trim()) form.set("idea", request.idea.trim());
  if (request.transcript.trim())
    form.set("transcript", request.transcript.trim());
  if (request.platform) form.set("platform", request.platform);
  if (request.publishDate) form.set("publishDate", request.publishDate);
  form.set("language", request.language);
  for (const file of request.files) form.append("files", file, file.name);

  const token = getAccessToken();
  const response = await fetch(`${API_URL}/tools/content-planner/ai-plans`, {
    method: "POST",
    body: form,
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!response.ok || !response.body) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message)
        ? body.message[0]!
        : (body.message ?? message);
    } catch {
      // keep the generic message
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: Extract<PlanningEvent, { type: "done" }> | null = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(finished ? `${buffer}\n\n` : buffer);
    buffer = parsed.rest;
    for (const event of parsed.events) {
      onEvent(event);
      if (event.type === "error") throw new Error(event.error);
      if (event.type === "done") done = event;
    }
    if (finished) break;
  }
  if (!done) throw new Error("Planning ended unexpectedly");
  return done;
}

// ─── From plan to calendar ──────────────────────────────────────────

/**
 * AI steps → production steps for the scheduler/editor. A step named like
 * its built-in type (in the UI language) stays a built-in step; any other
 * name becomes a custom step with that built-in type's look.
 */
export function aiPlanToSteps(
  plan: AiPlanResult,
  builtinName: (type: ContentEventType) => string,
): ProductionStep[] {
  return plan.steps.map((step) => {
    const type = (CONTENT_EVENT_TYPES as readonly string[]).includes(step.type)
      ? step.type
      : "OTHER";
    const sameAsBuiltin =
      step.name.trim().toLowerCase() === builtinName(type).toLowerCase() ||
      step.name.trim().toLowerCase() === type.toLowerCase();
    return {
      key: newStepKey(),
      baseType: type,
      name: sameAsBuiltin ? null : step.name.trim(),
      color: null,
      icon: null,
      durationMinutes: step.durationMinutes,
      enabled: true,
      isPublish: step.isPublish,
      toolAction: step.toolAction
        ? {
            toolId: step.toolAction.toolId,
            intention: step.toolAction.intention,
            prompt: step.toolAction.prompt,
          }
        : null,
    };
  });
}

/** Publish date when none was chosen: today + N working days, at 18:00. */
export function suggestedPublishDate(
  workingDays: number,
  skipWeekends: boolean,
  from: Date = new Date(),
): Date {
  let day = startOfDay(from);
  let left = Math.max(1, workingDays);
  while (left > 0) {
    day = addDays(day, 1);
    if (!skipWeekends || !isWeekend(day)) left--;
  }
  day.setHours(18, 0, 0, 0);
  return day;
}

/** Link that opens a tool with its input pre-filled (`?prompt=`). */
export function toolUrl(action: ToolAction): string {
  const base = `/tools/${encodeURIComponent(action.toolId)}`;
  return action.prompt
    ? `${base}?prompt=${encodeURIComponent(action.prompt)}`
    : base;
}
