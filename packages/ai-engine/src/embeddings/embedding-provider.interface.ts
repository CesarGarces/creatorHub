/**
 * Text → vector providers for retrieval (RAG). Each provider is identified
 * by the embedding model it runs: vectors produced by different models are
 * not comparable and must never be mixed in one similarity search.
 */
export interface EmbeddingProviderInterface {
  /** Provider slug, matching ModelMetadata.providerSlug (e.g. "siliconflow"). */
  readonly slug: string;
  /** Whether it can be used right now (e.g. API key configured). */
  isAvailable(): boolean;
  /** One vector per text, in the same order. */
  embed(modelId: string, texts: string[]): Promise<number[][]>;
}

/** The embedder chosen for a request, with what it costs. */
export interface ResolvedEmbedder {
  /** Stable id stored next to every vector, e.g. "siliconflow:BAAI/bge-m3". */
  modelKey: string;
  displayName: string;
  /** Credits per run (the admin-configured ModelMetadata.creditCost; 0 for the local embedder). */
  creditCost: number;
  /** True when it calls an external API (and may cost credits). */
  remote: boolean;
  /**
   * Cosine score from which a result counts as related. Depends on the
   * model: lexical vectors of unrelated texts score ~0, semantic models
   * (e.g. bge-m3) give unrelated texts ~0.3–0.45.
   */
  minSimilarity: number;
  embed(texts: string[]): Promise<number[][]>;
}
