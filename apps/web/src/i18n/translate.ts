/**
 * The web app's dictionaries bound to the shared translation engine.
 * Server-safe: used by layouts/metadata as well as client components.
 */
import {
  createTranslator,
  type DictionaryShape,
  type KeyOf,
} from "@creator-hub/i18n";
import { en } from "./messages/en/index";
import { es } from "./messages/es/index";
import { pt } from "./messages/pt/index";

/** Shape of a dictionary: same tree as English, every leaf is a string. */
export type Messages = DictionaryShape<typeof en>;

/** Every valid key, e.g. "settings.title" (plural keys without `_one/_other`). */
export type TranslationKey = KeyOf<Messages>;

export type { TranslationParams } from "@creator-hub/i18n";

export const translator = createTranslator<Messages>({ en, es, pt });

export const { translate, hasTranslation, getMessages } = translator;
