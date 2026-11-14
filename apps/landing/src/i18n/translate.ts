/**
 * Landing-page dictionaries bound to the shared engine (@creator-hub/i18n).
 * Server-safe: used for metadata as well as client components.
 */
import {
  createTranslator,
  type DictionaryShape,
  type KeyOf,
} from "@creator-hub/i18n";
import { en } from "./messages/en";
import { es } from "./messages/es";
import { pt } from "./messages/pt";

export type Messages = DictionaryShape<typeof en>;
export type TranslationKey = KeyOf<Messages>;

export const translator = createTranslator<Messages>({ en, es, pt });

export const { translate, getMessages } = translator;
