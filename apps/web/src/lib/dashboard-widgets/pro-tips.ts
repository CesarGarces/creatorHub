import type { Locale } from "@creator-hub/i18n";

/**
 * "Pro tip" widget: tips on using Creator Hub and growing a channel, kept
 * as JSON content (`src/content/pro-tips/<locale>.json`, the same tips in
 * every language, by id) and shown one per hour (ARCHITECTURE.md §2f).
 */
export const PRO_TIP_CATEGORIES = [
  "dashboard",
  "calendar",
  "ai-planner",
  "viral",
  "thumbnails",
  "scripts",
  "assistant",
  "clipper",
  "social",
  "assets",
  "credits",
  "account",
] as const;

export type ProTipCategory = (typeof PRO_TIP_CATEGORIES)[number];

export interface ProTip {
  id: string;
  category: ProTipCategory;
  title: string;
  body: string;
}

/**
 * One chunk per language: only the user's language is downloaded, and only
 * when the widget is shown.
 */
const LOADERS: Record<Locale, () => Promise<{ default: unknown }>> = {
  en: () => import("@/content/pro-tips/en.json"),
  es: () => import("@/content/pro-tips/es.json"),
  pt: () => import("@/content/pro-tips/pt.json"),
};

const isCategory = (value: unknown): value is ProTipCategory =>
  typeof value === "string" &&
  (PRO_TIP_CATEGORIES as readonly string[]).includes(value);

/** The valid tips of a tips file (malformed entries are skipped). */
export function parseProTips(value: unknown): ProTip[] {
  const tips = (value as { tips?: unknown } | null)?.tips;
  if (!Array.isArray(tips)) return [];
  return tips.flatMap((tip): ProTip[] => {
    const t = tip as Partial<Record<keyof ProTip, unknown>> | null;
    return t &&
      typeof t.id === "string" &&
      isCategory(t.category) &&
      typeof t.title === "string" &&
      t.title.trim() &&
      typeof t.body === "string" &&
      t.body.trim()
      ? [{ id: t.id, category: t.category, title: t.title, body: t.body }]
      : [];
  });
}

export async function loadProTips(locale: Locale): Promise<ProTip[]> {
  const file = await (LOADERS[locale] ?? LOADERS.en)();
  return parseProTips(file.default);
}

/**
 * Hours since the epoch on the user's clock: changes at :00 local time
 * (also in time zones with a half-hour offset).
 */
export function localHour(date: Date): number {
  const local = date.getTime() - date.getTimezoneOffset() * 60_000;
  return Math.floor(local / 3_600_000);
}

/** FNV-1a: a stable 32-bit seed from a string. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, seeded PRNG in [0, 1). */
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** 0…count-1 shuffled (Fisher–Yates) with a seeded PRNG. */
function shuffled(count: number, seed: number): number[] {
  const next = random(seed);
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

function cycleOrder(cycle: number, count: number, salt: string): number[] {
  const order = shuffled(count, hash(`${salt}:${cycle}`));
  // The previous cycle's last tip must not open this one (no repeat across
  // the boundary). Only the first two places change, so a cycle's last tip
  // is always its shuffle's last (count ≥ 3).
  const previousLast = shuffled(count, hash(`${salt}:${cycle - 1}`))[count - 1];
  if (order[0] === previousLast) [order[0], order[1]] = [order[1]!, order[0]!];
  return order;
}

/**
 * Which tip to show in a given hour: a random order, different for each
 * user (`salt`) and each cycle of `count` hours, in which every tip appears
 * once — and never the same tip two hours in a row. Deterministic: the
 * same hour gives the same tip on every reload and device.
 */
export function tipIndexForHour(
  hour: number,
  count: number,
  salt = "",
): number {
  if (count <= 0) return -1;
  if (count < 3) return ((hour % count) + count) % count;
  const cycle = Math.floor(hour / count);
  return cycleOrder(cycle, count, salt)[hour - cycle * count]!;
}
