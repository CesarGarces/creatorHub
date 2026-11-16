import type { EmbeddingProviderInterface } from "./embedding-provider.interface";

const BATCH_SIZE = 32;
const TIMEOUT_MS = 30_000;

/**
 * Embeddings through SiliconFlow's OpenAI-compatible `/embeddings` endpoint
 * (e.g. BAAI/bge-m3). Used when an admin activates an "embedding" model of
 * provider "siliconflow" and SILICONFLOW_API_KEY is set.
 */
export class SiliconFlowEmbeddingProvider implements EmbeddingProviderInterface {
  readonly slug = "siliconflow";
  private readonly baseUrl = "https://api.siliconflow.com/v1";

  constructor(
    private readonly apiKey = process.env.SILICONFLOW_API_KEY || "",
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async embed(modelId: string, texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      vectors.push(
        ...(await this.embedBatch(modelId, texts.slice(i, i + BATCH_SIZE))),
      );
    }
    return vectors;
  }

  private async embedBatch(
    modelId: string,
    input: string[],
  ): Promise<number[][]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          input,
          encoding_format: "float",
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Embedding request failed (${response.status}): ${(await response.text()).slice(0, 200)}`,
        );
      }
      const body = (await response.json()) as {
        data?: { index: number; embedding: number[] }[];
      };
      const data = [...(body.data ?? [])].sort((a, b) => a.index - b.index);
      if (data.length !== input.length) {
        throw new Error(
          `Embedding response has ${data.length} vectors for ${input.length} texts`,
        );
      }
      return data.map((d) => d.embedding);
    } finally {
      clearTimeout(timer);
    }
  }
}
