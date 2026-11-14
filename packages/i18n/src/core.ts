/**
 * Framework-agnostic translation engine. Safe to use on the server.
 */
import { DEFAULT_LOCALE, LOCALE_META, type Locale } from "./config";

// Replaced at build time by the apps' bundlers; declared to avoid a
// dependency on Node typings.
declare const process: { env: { NODE_ENV?: string } };

/** Shape of a dictionary: same tree as the source language, leaves are strings. */
export type DictionaryShape<T> = {
  [K in keyof T]: T[K] extends string ? string : DictionaryShape<T[K]>;
};

/** Every dotted path to a leaf, e.g. "settings.language.title". */
type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * Plural variants are stored as `key_one` / `key_other` and requested as
 * `t("key", { count })`.
 */
type PluralBase<K> = K extends `${infer Base}_${PluralSuffix}` ? Base : never;

/** Valid keys of a dictionary type (leaves + plural bases). */
export type KeyOf<M> = LeafPaths<M> | PluralBase<LeafPaths<M>>;

export type TranslationParams = Record<string, string | number>;

export interface Translator<M> {
  translate: (
    locale: Locale,
    key: KeyOf<M>,
    params?: TranslationParams,
  ) => string;
  /** True when a (possibly data-driven) key exists. */
  hasTranslation: (locale: Locale, key: string) => boolean;
  /** Like translate, for data-driven keys that may not exist. */
  translateOptional: (
    locale: Locale,
    key: string,
    fallback: string,
    params?: TranslationParams,
  ) => string;
  getMessages: (locale: Locale) => M;
}

function lookup(messages: unknown, key: string): string | undefined {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function pluralCategory(locale: Locale, count: number): string {
  const tag = LOCALE_META[locale].intlLocale;
  let rules = pluralRulesCache.get(tag);
  if (!rules) {
    rules = new Intl.PluralRules(tag);
    pluralRulesCache.set(tag, rules);
  }
  return rules.select(count);
}

function formatNumberParam(locale: Locale, value: number): string {
  const tag = LOCALE_META[locale].intlLocale;
  let nf = numberFormatCache.get(tag);
  if (!nf) {
    nf = new Intl.NumberFormat(tag);
    numberFormatCache.set(tag, nf);
  }
  return nf.format(value);
}

/** Replaces `{name}` placeholders. Numbers are formatted for the locale (1,500 vs 1.500). */
export function interpolate(
  locale: Locale,
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    return typeof value === "number" ? formatNumberParam(locale, value) : value;
  });
}

/**
 * Binds dictionaries (one per locale, all with the same shape) to a
 * translator. Missing keys fall back to `fallbackLocale`, then to the key
 * itself, so a gap never renders as blank UI.
 */
export function createTranslator<M>(
  dictionaries: Record<Locale, M>,
  { fallbackLocale = DEFAULT_LOCALE }: { fallbackLocale?: Locale } = {},
): Translator<M> {
  const resolve = (
    locale: Locale,
    key: string,
    params?: TranslationParams,
  ): string | undefined => {
    const messages = dictionaries[locale];
    const count = params?.count;
    if (typeof count === "number") {
      const plural =
        lookup(messages, `${key}_${pluralCategory(locale, count)}`) ??
        lookup(messages, `${key}_other`);
      if (plural !== undefined) return plural;
    }
    return lookup(messages, key);
  };

  const resolveWithFallback = (
    locale: Locale,
    key: string,
    params?: TranslationParams,
  ) =>
    resolve(locale, key, params) ??
    (locale !== fallbackLocale
      ? resolve(fallbackLocale, key, params)
      : undefined);

  return {
    translate: (locale, key, params) => {
      const template = resolveWithFallback(locale, key, params);
      if (template === undefined) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[i18n] Missing translation key: "${key}"`);
        }
        return key;
      }
      return interpolate(locale, template, params);
    },
    hasTranslation: (locale, key) => resolve(locale, key) !== undefined,
    translateOptional: (locale, key, fallback, params) => {
      const template = resolve(locale, key, params);
      return template === undefined
        ? fallback
        : interpolate(locale, template, params);
    },
    getMessages: (locale) => dictionaries[locale],
  };
}
