/** Cosine similarity in [-1, 1]; 0 when either vector is empty or all zeros. */
export function cosineSimilarity(
  a: readonly number[],
  b: readonly number[],
): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Scales a vector to unit length (returns it unchanged when all zeros). */
export function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

export interface Scored<T> {
  item: T;
  score: number;
}

/** The `k` items most similar to `query`, best first, above `minScore`. */
export function topKBySimilarity<T>(
  query: readonly number[],
  items: readonly T[],
  vectorOf: (item: T) => readonly number[],
  k: number,
  minScore = 0,
): Scored<T>[] {
  return items
    .map((item) => ({ item, score: cosineSimilarity(query, vectorOf(item)) }))
    .filter((s) => s.score > minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
