import { LOCALE_META, type Locale } from "./config";
import { en } from "./messages/en/index";
import { es } from "./messages/es/index";
import { pt } from "./messages/pt/index";

/** Shape of a dictionary: same tree as English, every leaf is a string. */
type DeepStringTree<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringTree<T[K]>;
};

export type Messages = DeepStringTree<typeof en>;

/** Every dotted path to a leaf, e.g. "settings.language.title". */
type LeafPaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : LeafPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

type RawKey = LeafPaths<Messages>;

/**
 * Plural variants are stored as `key_one` / `key_other` and requested as
 * `t("key", { count })`.
 */
type PluralBase<K> =
  K extends `${infer Base}_${"zero" | "one" | "two" | "few" | "many" | "other"}`
    ? Base
    : never;

export type TranslationKey = RawKey | PluralBase<RawKey>;

export type TranslationParams = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Messages> = { en, es, pt };

export function getMessages(locale: Locale): Messages {
  return DICTIONARIES[locale];
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

function resolveTemplate(
  locale: Locale,
  key: string,
  params?: TranslationParams,
): string | undefined {
  const messages = DICTIONARIES[locale];
  const count = params?.count;
  if (typeof count === "number") {
    const plural =
      lookup(messages, `${key}_${pluralCategory(locale, count)}`) ??
      lookup(messages, `${key}_other`);
    if (plural !== undefined) return plural;
  }
  return lookup(messages, key);
}

/**
 * Resolves a key for a locale. Falls back to English, then to the key itself,
 * so a missing translation never renders as blank UI.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const template =
    resolveTemplate(locale, key, params) ??
    (locale !== "en" ? resolveTemplate("en", key, params) : undefined);

  if (template === undefined) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] Missing translation key: "${key}"`);
    }
    return key;
  }
  return interpolate(locale, template, params);
}

/** True when a key exists (useful for optional, data-driven labels). */
export function hasTranslation(locale: Locale, key: string): boolean {
  return resolveTemplate(locale, key) !== undefined;
}
