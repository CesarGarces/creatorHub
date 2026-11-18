import { isTTSLanguage, type TTSLanguage } from "@creator-hub/shared-types";

/**
 * Which language the user is speaking — English, Spanish or Portuguese —
 * so Robotina answers (and speaks, with the matching Aura-2 voice) in it.
 *
 * Deepgram's multilingual STT transcribes the words but the transcript
 * carries no language, and typed messages have none either, so this is a
 * small lexical detector: frequent function words and the letters/marks
 * only one of the three languages uses (ñ ¿ ¡ vs. ã õ ç ê ô). Words the
 * languages share ("que", "para", "como", "no"…) are deliberately absent.
 * Short or ambiguous text returns null: the caller keeps the conversation's
 * language (then the interface language).
 */

// prettier-ignore
const WORDS: Record<TTSLanguage, readonly string[]> = {
  en: [
    "the", "and", "is", "are", "was", "were", "you", "your", "what",
    "how", "why", "who", "where", "when", "which", "i", "i'm", "my",
    "it", "it's", "to", "of", "in", "that", "this", "with", "for",
    "do", "does", "did", "can", "could", "would", "should", "will", "please",
    "hello", "hi", "hey", "thanks", "thank", "tell", "about", "have", "has",
    "be", "know", "want", "like", "think", "yes", "not", "don't", "some",
    "good", "morning", "night", "today", "there", "they", "we", "our",
    "an", "or", "but", "if", "just", "really", "story", "joke", "help",
  ],
  es: [
    "el", "la", "los", "las", "del", "al", "y", "es", "soy", "eres",
    "está", "están", "estás", "estoy", "por", "con", "una", "unos", "unas",
    "qué", "cómo", "cuál", "cuándo", "dónde", "quién", "yo", "tú", "usted",
    "ustedes", "mi", "mis", "muy", "pero", "hola", "gracias",
    "quiero", "puedes", "puede", "dime", "también", "hay", "eso", "esto",
    "tengo", "tienes", "hacer", "bueno", "buenos", "buenas",
    "sí", "ahora", "todavía", "cosa", "nosotros", "ella", "ellos", "le",
    "lo", "algo", "mucho", "hoy", "días", "noches", "cuéntame", "chiste",
    "ayuda", "ayúdame", "necesito", "sabes", "pues",
  ],
  pt: [
    "e", "os", "um", "uma", "umas", "uns", "do", "da", "dos", "das", "ao",
    "à", "na", "nas", "é", "são", "sou", "você", "vocês", "eu", "meu",
    "minha", "não", "com", "muito", "olá", "oi", "obrigado",
    "obrigada", "qual", "quero", "pode", "também", "isso", "isto", "essa",
    "esse", "tenho", "tem", "fazer", "bom", "boa", "sim", "então", "agora",
    "ainda", "coisa", "gente", "né", "tá", "legal", "tudo", "dia", "noite",
    "conta", "conte", "piada", "ajuda", "preciso", "ela", "eles",
    "nós", "hoje", "estou", "onde", "quando", "quem",
  ],
};

/** Guard: a word listed for two languages would count for neither. */
const AMBIGUOUS: ReadonlySet<string> = (() => {
  const seen = new Map<string, number>();
  for (const list of Object.values(WORDS)) {
    for (const word of new Set(list)) seen.set(word, (seen.get(word) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, n]) => n > 1).map(([w]) => w));
})();

const LEXICON: ReadonlyMap<string, TTSLanguage> = (() => {
  const map = new Map<string, TTSLanguage>();
  for (const language of Object.keys(WORDS) as TTSLanguage[]) {
    for (const word of WORDS[language]) {
      if (!AMBIGUOUS.has(word)) map.set(word, language);
    }
  }
  return map;
})();

/** Letters and marks only one language uses, with their weight. */
const MARKS: Array<{ pattern: RegExp; language: TTSLanguage; weight: number }> =
  [
    { pattern: /[ñ¿¡]/g, language: "es", weight: 2 },
    { pattern: /(ción|ciones)\b/g, language: "es", weight: 1 },
    { pattern: /[ãõç]/g, language: "pt", weight: 2 },
    { pattern: /[êô]/g, language: "pt", weight: 1 },
    { pattern: /(ção|ções)\b/g, language: "pt", weight: 1 },
  ];

export interface LanguageScores {
  en: number;
  es: number;
  pt: number;
}

export function languageScores(text: string): LanguageScores {
  const scores: LanguageScores = { en: 0, es: 0, pt: 0 };
  const lower = text.toLowerCase();
  const words = lower.match(/[\p{L}']+/gu) ?? [];
  for (const word of words) {
    const language = LEXICON.get(word);
    if (language) scores[language] += 1;
  }
  for (const { pattern, language, weight } of MARKS) {
    scores[language] += (lower.match(pattern)?.length ?? 0) * weight;
  }
  return scores;
}

/** The language of `text`, or null when it's too short or too close to call. */
export function detectLanguage(text: string): TTSLanguage | null {
  const scores = languageScores(text);
  const ranked = (Object.keys(scores) as TTSLanguage[]).sort(
    (a, b) => scores[b] - scores[a],
  );
  const best = ranked[0]!;
  const second = ranked[1]!;
  if (scores[best] === 0 || scores[best] === scores[second]) return null;
  return best;
}

/**
 * The language Robotina answers in: the message's own language, else the
 * conversation's, else the interface language, else English.
 */
export function resolveReplyLanguage(input: {
  text: string;
  previous?: string | null;
  hint?: string | null;
}): TTSLanguage {
  return (
    detectLanguage(input.text) ??
    (isTTSLanguage(input.previous) ? input.previous : null) ??
    (isTTSLanguage(input.hint) ? input.hint : null) ??
    "en"
  );
}

export const LANGUAGE_NAMES: Record<TTSLanguage, string> = {
  en: "English",
  es: "Spanish",
  pt: "Brazilian Portuguese",
};
