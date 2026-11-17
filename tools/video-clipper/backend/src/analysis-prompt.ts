import type { AIImageInput } from "@creator-hub/shared-types";
import {
  CLIP_LENGTH_RULES,
  LANGUAGE_NAMES,
  MAX_HASHTAGS,
  MAX_HIGHLIGHTS,
  MAX_HOOKS,
  MAX_TITLES,
  type AnalysisLanguage,
  type ClipPlatform,
} from "./video-clipper.constants";
import type {
  HookSuggestion,
  TitleSuggestion,
  VideoHighlight,
  VideoKeyframe,
  VideoMetadata,
} from "./video-clipper.types";

/** Shortest clip kept (only reachable for videos shorter than the platform minimum). */
const MIN_CLIP_SEC = 1;

/** The model's reply is not usable (no JSON, or no valid highlight). */
export class AnalysisParseError extends Error {}

/** "83.4" → "01:23", "3725" → "1:02:05". */
export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export interface AnalysisPromptInput {
  video: VideoMetadata;
  frames: VideoKeyframe[];
  platform: ClipPlatform;
  language: AnalysisLanguage;
  context?: string;
}

export interface AnalysisPrompt {
  systemPrompt: string;
  prompt: string;
  images: AIImageInput[];
}

/**
 * System prompt (role + strict JSON contract), user prompt (metadata) and
 * the keyframes, each captioned with its timestamp so the model can anchor
 * highlights to real moments of the video.
 */
export function buildAnalysisPrompt(
  input: AnalysisPromptInput,
): AnalysisPrompt {
  const rules = CLIP_LENGTH_RULES[input.platform];
  const duration = round1(input.video.durationSec);
  const language = LANGUAGE_NAMES[input.language];
  const orientation =
    input.video.width && input.video.height
      ? input.video.width >= input.video.height
        ? `landscape ${input.video.width}x${input.video.height}`
        : `vertical ${input.video.width}x${input.video.height}`
      : "unknown";

  const systemPrompt = `You are a senior short-form video editor and growth strategist.
You receive keyframes sampled at regular intervals from ONE video, each labelled with its timestamp in seconds. Between two keyframes the content is unknown: infer continuity from what you see.

Your job: find the moments most likely to perform as standalone clips on ${rules.label}, and write hooks and titles that maximise retention and click-through.

Reply with ONLY a JSON object (no prose, no markdown fences) with exactly this shape:
{
  "summary": "2-3 sentences describing the video",
  "contentType": "one or two words, e.g. tutorial, vlog, gaming, podcast, interview, review",
  "highlights": [
    {
      "start": 12.5,
      "end": 41.0,
      "title": "catchy clip title (max 80 characters)",
      "hook": "first line to say or show on screen in the first 3 seconds",
      "reason": "why this moment works as a clip",
      "score": 87,
      "tags": ["keyword", "keyword"]
    }
  ],
  "hooks": [{ "text": "hook for the full video", "style": "question | bold-claim | curiosity-gap | story | shock-stat" }],
  "titles": [{ "text": "optimised title for the full video", "platform": "youtube | tiktok | instagram" }],
  "hashtags": ["#tag"]
}

Rules:
- "start" and "end" are seconds from the beginning (numbers), 0 <= start < end <= ${duration}.
- Every highlight lasts between ${rules.min} and ${rules.max} seconds and starts slightly before the key action so the clip has context.
- Return 3 to ${MAX_HIGHLIGHTS} highlights that do not overlap, best first. "score" is 0-100 (predicted engagement).
- Return up to ${MAX_HOOKS} hooks, up to ${MAX_TITLES} titles (max 100 characters each) and up to ${MAX_HASHTAGS} hashtags.
- Base everything on what is visible in the keyframes; never invent people, brands or events you cannot see.
- Write every text field in ${language}.`;

  const lines = [
    `Video file: ${input.video.fileName}`,
    `Duration: ${duration} s (${formatTimestamp(duration)})`,
    `Format: ${orientation}`,
    `Target platform: ${rules.label}`,
    `Keyframes: ${input.frames.length}, at ${input.frames
      .map((f) => `${round1(f.timestamp)}s`)
      .join(", ")}`,
  ];
  const context = input.context?.trim();
  if (context) lines.push(`Creator notes about the video: ${context}`);
  lines.push("Analyse the keyframes below and reply with the JSON object.");

  const images: AIImageInput[] = input.frames.map((frame, i) => ({
    url: frame.image,
    caption: `Keyframe ${i + 1}/${input.frames.length} — t=${round1(frame.timestamp)}s (${formatTimestamp(frame.timestamp)})`,
    detail: "low",
  }));

  return { systemPrompt, prompt: lines.join("\n"), images };
}

// ──────────────────────────────────────────────
// REPLY PARSING
// ──────────────────────────────────────────────

export interface ParseOptions {
  durationSec: number;
  platform: ClipPlatform;
}

export interface ParsedAnalysis {
  summary: string;
  contentType: string | null;
  highlights: VideoHighlight[];
  hooks: HookSuggestion[];
  titles: TitleSuggestion[];
  hashtags: string[];
}

/**
 * Turns the model's reply into a safe, normalised analysis. Tolerates prose
 * and code fences around the JSON, "mm:ss" timestamps and alternative key
 * names; clamps clips to the video and the platform's length rules and
 * removes overlaps. Throws `AnalysisParseError` when nothing usable is left
 * (the user is not charged in that case).
 */
export function parseAnalysisResponse(
  raw: string,
  options: ParseOptions,
): ParsedAnalysis {
  const data = extractJsonObject(raw);
  const duration = Math.max(0, options.durationSec);
  const rules = CLIP_LENGTH_RULES[options.platform];

  const candidates = asArray(data.highlights ?? data.clips ?? data.moments)
    .map((item) => normaliseHighlight(item, duration, rules))
    .filter((h): h is Omit<VideoHighlight, "id"> => h !== null);

  const highlights = pickBest(removeOverlaps(candidates, rules.min))
    .sort((a, b) => a.start - b.start)
    .map((h, i) => ({ id: `h${i + 1}`, ...h }));

  if (highlights.length === 0) {
    throw new AnalysisParseError("The reply has no valid highlight");
  }

  return {
    summary: text(data.summary ?? data.description, 600),
    contentType: text(data.contentType ?? data.content_type, 40) || null,
    highlights,
    hooks: uniqueBy(
      asArray(data.hooks).flatMap((item): HookSuggestion[] => {
        const value = text(
          isObject(item) ? (item.text ?? item.hook) : item,
          200,
        );
        if (!value) return [];
        const style = isObject(item) ? text(item.style ?? item.type, 40) : "";
        return [{ text: value, style: style || null }];
      }),
      (h) => h.text,
    ).slice(0, MAX_HOOKS),
    titles: uniqueBy(
      asArray(data.titles).flatMap((item): TitleSuggestion[] => {
        const value = text(
          isObject(item) ? (item.text ?? item.title) : item,
          100,
        );
        if (!value) return [];
        const platform = isObject(item) ? text(item.platform, 40) : "";
        return [{ text: value, platform: platform || null }];
      }),
      (t) => t.text,
    ).slice(0, MAX_TITLES),
    hashtags: uniqueBy(
      asArray(data.hashtags ?? data.tags).flatMap((item) => {
        const tag = String(typeof item === "string" ? item : "")
          .replace(/^#+/, "")
          .replace(/[^\p{L}\p{N}_]/gu, "");
        return tag ? [`#${tag.slice(0, 40)}`] : [];
      }),
      (t) => t,
    ).slice(0, MAX_HASHTAGS),
  };
}

/** Seconds from a number, "12.5", "12.5s", "mm:ss" or "hh:mm:ss(.ms)". */
export function toSeconds(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value !== "string") return NaN;
  const v = value.trim().replace(/s$/i, "");
  if (/^\d+(?:\.\d+)?$/.test(v)) return Number(v);
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(v);
  if (!match) return NaN;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s);
}

function normaliseHighlight(
  item: unknown,
  duration: number,
  rules: { min: number; max: number },
): Omit<VideoHighlight, "id"> | null {
  if (!isObject(item)) return null;
  let start = toSeconds(item.start ?? item.startTime ?? item.start_time);
  let end = toSeconds(item.end ?? item.endTime ?? item.end_time);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  start = clamp(start, 0, duration);
  end = clamp(end, 0, duration);
  if (end <= start) return null;

  // Platform length rules: too long → cut; too short → widen around it.
  if (end - start > rules.max) end = start + rules.max;
  if (end - start < rules.min) {
    end = Math.min(duration, start + rules.min);
    if (end - start < rules.min) start = Math.max(0, end - rules.min);
  }
  // Only videos shorter than the minimum can still be below it: keep ≥ 1 s.
  if (end - start < MIN_CLIP_SEC) return null;

  const title = text(item.title ?? item.name, 100);
  let score = Number(item.score ?? item.viralityScore ?? item.virality_score);
  if (!Number.isFinite(score)) score = 50;
  if (score > 0 && score < 1) score *= 100; // 0–1 scale

  return {
    start: round1(start),
    end: round1(end),
    title,
    hook: text(item.hook ?? item.hookText ?? item.hook_text, 160),
    reason: text(item.reason ?? item.why ?? item.description, 300),
    score: Math.round(clamp(score, 0, 100)),
    tags: asArray(item.tags)
      .map((t) => text(t, 30))
      .filter(Boolean)
      .slice(0, 5),
  };
}

/**
 * Sorted by start; a clip overlapping the previous one by half (of the
 * shorter) or more competes with it (higher score wins); a smaller overlap
 * is trimmed off the later clip if it stays long enough.
 */
function removeOverlaps<
  T extends { start: number; end: number; score: number },
>(items: T[], minLength: number): T[] {
  const kept: T[] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const prev = kept[kept.length - 1];
    if (!prev || item.start >= prev.end) {
      kept.push(item);
      continue;
    }
    const overlap = Math.min(prev.end, item.end) - item.start;
    const shorter = Math.min(prev.end - prev.start, item.end - item.start);
    if (overlap >= shorter / 2) {
      if (item.score > prev.score) kept[kept.length - 1] = item;
      continue;
    }
    const trimmed = { ...item, start: round1(prev.end) };
    if (trimmed.end - trimmed.start >= minLength) kept.push(trimmed);
  }
  return kept;
}

/** The `MAX_HIGHLIGHTS` best clips (score, then earliest). */
function pickBest<T extends { start: number; score: number }>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, MAX_HIGHLIGHTS);
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const cleaned = (raw ?? "").replace(/```(?:json)?/gi, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last <= first) {
    throw new AnalysisParseError("The reply has no JSON object");
  }
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(first, last + 1));
    if (!isObject(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new AnalysisParseError("The reply is not valid JSON");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** Trimmed single-spaced string, cut to `max` characters ("" if not text). */
function text(value: unknown, max: number): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const s = String(value).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
