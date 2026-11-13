/**
 * Interface-language configuration.
 *
 * This is the *UI* language (buttons, labels, messages). It is unrelated to
 * the language a user picks for generated content (e.g. the Content
 * Translator target language or the script language).
 */
import { UI_LANGUAGES, type UiLanguage } from "@creator-hub/shared-types";

/** Shared with the API, which validates the saved account preference. */
export const LOCALES = UI_LANGUAGES;

export type Locale = UiLanguage;

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the chosen locale. Readable by the server to avoid a flash of the wrong language. */
export const LOCALE_COOKIE = "ch_locale";

/** The choice survives logouts and browser restarts for a year. */
export const LOCALE_COOKIE_MAX_AGE_DAYS = 365;

export interface LocaleMeta {
  /** Name of the language written in that language ("Español"). */
  nativeName: string;
  /** Name of the language in English, used as a secondary hint. */
  englishName: string;
  /** Regional flag shown next to the name. */
  flag: string;
  /** BCP 47 tag used for Intl formatting (dates, numbers, plurals). */
  intlLocale: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    nativeName: "English",
    englishName: "English",
    flag: "🇺🇸",
    intlLocale: "en-US",
  },
  es: {
    nativeName: "Español",
    englishName: "Spanish",
    flag: "🇪🇸",
    intlLocale: "es-ES",
  },
  pt: {
    nativeName: "Português",
    englishName: "Portuguese",
    flag: "🇧🇷",
    intlLocale: "pt-BR",
  },
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Picks the best supported locale from an `Accept-Language` header
 * (e.g. "es-AR,es;q=0.9,en;q=0.8"). Used only when the user has not chosen a
 * language yet.
 */
export function matchAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: tag.toLowerCase(), q: Number.isNaN(q) ? 0 : q };
    })
    .filter((c) => c.tag && c.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
