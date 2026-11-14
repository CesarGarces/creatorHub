/**
 * Consistency checks for dictionaries, meant to be run from each app's test
 * suite: every language must have the same keys as the source language and
 * keep its `{placeholders}` and `<tags>`.
 */
import type { Locale } from "./config";

type Tree = { [key: string]: unknown };

function flatten(tree: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  if (tree === null || typeof tree !== "object") return out;
  for (const [key, value] of Object.entries(tree as Tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (s: string) =>
  [...s.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");
const tags = (s: string) =>
  [...s.matchAll(/<(\w+)>/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

/** Returns a human-readable list of problems (empty when consistent). */
export function findDictionaryIssues<M>(
  dictionaries: Record<Locale, M>,
  sourceLocale: Locale = "en",
): string[] {
  const source = flatten(dictionaries[sourceLocale]);
  const issues: string[] = [];

  for (const [locale, dictionary] of Object.entries(dictionaries) as [
    Locale,
    M,
  ][]) {
    if (locale === sourceLocale) continue;
    const target = flatten(dictionary);

    for (const [key, text] of Object.entries(source)) {
      const translated = target[key];
      if (translated === undefined) {
        issues.push(`${locale}: missing "${key}"`);
        continue;
      }
      if (translated.trim() === "") issues.push(`${locale}: empty "${key}"`);
      if (placeholders(text) !== placeholders(translated)) {
        issues.push(`${locale}: placeholders differ in "${key}"`);
      }
      if (tags(text) !== tags(translated)) {
        issues.push(`${locale}: tags differ in "${key}"`);
      }
    }
    for (const key of Object.keys(target)) {
      if (!(key in source)) issues.push(`${locale}: unexpected "${key}"`);
    }
  }
  return issues;
}
