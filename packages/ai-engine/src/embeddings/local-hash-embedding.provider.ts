import { normalize } from "./vector-math";

/** Model key stored with vectors produced by the local embedder. */
export const LOCAL_EMBEDDING_MODEL = "local:hash-v2";
export const LOCAL_EMBEDDING_DIMENSIONS = 384;

// Common words in the interface languages (en, es, pt) that carry no topic.
const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have how i in is it its of on or that the this to was " +
    "we were what when where which who will with you your my our " +
    "el la los las un una unos unas y o de del al en con por para que es son como mi mis tu su sus " +
    "lo se no si mas pero este esta esto ese esa " +
    "o os as um uma e de do da dos das no na nos nas em com por para que como meu minha seu sua nao mais " +
    // Words nearly every creator text contains (accents are stripped before
    // the lookup: "vídeo" → "video"). They would make every project look
    // alike; the platform is matched separately.
    "video videos youtube tiktok reels shorts instagram twitch"
  ).split(" "),
);

/**
 * Cosine score from which two texts count as related for this embedder.
 * Lexical vectors of unrelated texts score ~0; one shared topic word in a
 * short title already gives ~0.2.
 */
export const LOCAL_EMBEDDING_MIN_SIMILARITY = 0.15;

function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // strip accents: "edición" → "edicion"
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** 32-bit FNV-1a. */
function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Dependency-free embedder ("hashing trick"): words (unigrams) with
 * sub-linear term frequency, hashed into a fixed-size signed vector and
 * L2-normalised. Captures lexical overlap (not deep semantics: "pizza dough"
 * and "sourdough bread" only share what they literally share), needs no
 * network or API key and costs nothing — the fallback whenever no remote
 * embedding model is configured, and in development/tests.
 *
 * v2: bigrams dropped (in short titles they rarely match and only dilute
 * the score) and creator-domain stopwords added.
 */
export class LocalHashEmbeddingProvider {
  embedText(text: string): number[] {
    const tokens = tokenize(text);
    const counts = new Map<string, number>();
    const add = (feature: string) =>
      counts.set(feature, (counts.get(feature) ?? 0) + 1);
    tokens.forEach(add);

    const vector = new Array<number>(LOCAL_EMBEDDING_DIMENSIONS).fill(0);
    for (const [feature, count] of counts) {
      const hash = fnv1a(feature);
      const index = hash % LOCAL_EMBEDDING_DIMENSIONS;
      const sign = (hash >>> 31) & 1 ? -1 : 1;
      vector[index]! += sign * (1 + Math.log(count));
    }
    return normalize(vector);
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.embedText(t));
  }
}
