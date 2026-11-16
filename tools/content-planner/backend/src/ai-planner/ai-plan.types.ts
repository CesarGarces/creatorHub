import type { ContentEventTypeValue } from "../content-planner.constants";

export const COMPLEXITY_LEVELS = ["low", "medium", "high"] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

export const PLAN_LANGUAGES = ["en", "es", "pt"] as const;
export type PlanLanguage = (typeof PLAN_LANGUAGES)[number];

/** A platform tool the assistant can suggest (from the Tool Registry). */
export interface AvailableTool {
  id: string;
  name: string;
  description: string;
}

/** "Use this tool, for this, with this input" — shown on the step/session. */
export interface AiPlanToolAction {
  toolId: string;
  toolName: string;
  intention: string;
  prompt: string;
}

export interface AiPlanStep {
  name: string;
  /** Closest built-in session type (OTHER when none fits). */
  type: ContentEventTypeValue;
  durationMinutes: number;
  description: string;
  /** Scheduled at the publish date/time. */
  isPublish: boolean;
  toolAction: AiPlanToolAction | null;
}

/** A past production retrieved by vector search (RAG evidence). */
export interface SimilarProduction {
  projectId: string;
  title: string;
  similarity: number;
  totalMinutes: number;
  sessions: number;
}

/** Deterministic analysis computed before asking the model. */
export interface ComplexitySignals {
  inputWords: number;
  sources: number;
  /** Document excerpts sent to the model (after retrieval). */
  excerpts: number;
  similarProductions: number;
  historyAverageMinutes: number | null;
  /** Tools the brief mentions (keyword match). */
  mentionedTools: string[];
  /** 1–5, used when the model doesn't rate complexity. */
  heuristicScore: number;
}

export interface AiPlanResult {
  title: string;
  summary: string;
  platform: string | null;
  complexity: { level: ComplexityLevel; score: number; rationale: string };
  signals: ComplexitySignals;
  steps: AiPlanStep[];
  totalMinutes: number;
  /** Working days the production needs before publishing. */
  suggestedPublishInDays: number;
  /** Average length of the most similar past productions, if any. */
  historyEstimateMinutes: number | null;
  similarProductions: SimilarProduction[];
  sources: { name: string; kind: string; chars: number; truncated: boolean }[];
  model: { id: string; name: string };
  embeddingModel: string;
}
