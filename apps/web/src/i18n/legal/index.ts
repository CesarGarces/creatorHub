import type { Locale } from "../config";
import type { LegalDocuments } from "./types";
import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";

export * from "./types";

const LEGAL: Record<Locale, LegalDocuments> = { en, es, pt };

export function getLegalDocuments(locale: Locale): LegalDocuments {
  return LEGAL[locale];
}
