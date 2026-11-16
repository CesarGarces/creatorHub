const mockPrisma = { modelMetadata: { findFirst: jest.fn() } };
jest.mock("@creator-hub/database", () => ({ prisma: mockPrisma, Prisma: {} }));

import {
  cosineSimilarity,
  normalize,
  topKBySimilarity,
} from "../embeddings/vector-math";
import {
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MIN_SIMILARITY,
  LOCAL_EMBEDDING_MODEL,
  LocalHashEmbeddingProvider,
} from "../embeddings/local-hash-embedding.provider";
import { SiliconFlowEmbeddingProvider } from "../embeddings/siliconflow-embedding.provider";
import {
  EmbeddingService,
  REMOTE_EMBEDDING_MIN_SIMILARITY,
} from "../embeddings/embedding.service";

beforeEach(() => jest.clearAllMocks());

describe("vector math", () => {
  it("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("normalizes to unit length and leaves zero vectors alone", () => {
    const v = normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(normalize([0, 0])).toEqual([0, 0]);
  });

  it("returns the top-k most similar items above the threshold", () => {
    const items = [
      { id: "same", v: [1, 0] },
      { id: "close", v: [0.9, 0.1] },
      { id: "orthogonal", v: [0, 1] },
      { id: "opposite", v: [-1, 0] },
    ];
    const top = topKBySimilarity([1, 0], items, (i) => i.v, 2);
    expect(top.map((s) => s.item.id)).toEqual(["same", "close"]);
    expect(
      topKBySimilarity([1, 0], items, (i) => i.v, 10).map((s) => s.item.id),
    ).toEqual(["same", "close"]);
  });
});

describe("LocalHashEmbeddingProvider", () => {
  const local = new LocalHashEmbeddingProvider();

  it("produces deterministic, unit-length vectors of fixed size", () => {
    const a = local.embedText("Studio tour video with B-roll");
    const b = local.embedText("Studio tour video with B-roll");
    expect(a).toHaveLength(LOCAL_EMBEDDING_DIMENSIONS);
    expect(a).toEqual(b);
    expect(Math.sqrt(a.reduce((s, v) => s + v * v, 0))).toBeCloseTo(1);
  });

  it("ranks related texts above unrelated ones", () => {
    const query = local.embedText("edit a cooking video recipe for YouTube");
    const related = local.embedText(
      "Cooking recipe video: filming and editing for YouTube",
    );
    const unrelated = local.embedText(
      "Quarterly tax report for the accounting department",
    );
    expect(cosineSimilarity(query, related)).toBeGreaterThan(0.3);
    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated) + 0.2,
    );
  });

  describe("separates related from unrelated projects at its threshold", () => {
    // Project topics (title + notes) vs. an idea, as the AI planner does.
    const idea = local.embedText(
      "A sourdough bread video for total beginners, with a timelapse of the dough.",
    );
    const score = (title: string) =>
      cosineSimilarity(idea, local.embedText(title));

    it.each([
      "Sourdough starter from scratch",
      "Baking bread for beginners",
      "Timelapse of my sourdough loaf",
    ])("related: %s", (title) => {
      expect(score(title)).toBeGreaterThanOrEqual(
        LOCAL_EMBEDDING_MIN_SIMILARITY,
      );
    });

    it.each([
      "Gaming setup tour",
      "My video editing workflow",
      "iPhone 16 review",
      "Weekly vlog episode 12",
    ])("unrelated: %s", (title) => {
      expect(score(title)).toBeLessThan(LOCAL_EMBEDDING_MIN_SIMILARITY);
    });
  });

  it("does not match on words every creator uses (video, platforms)", () => {
    expect(
      cosineSimilarity(
        local.embedText("My YouTube video about cars"),
        local.embedText("TikTok video: my morning routine"),
      ),
    ).toBe(0);
  });

  it("ignores accents, case and stopwords", () => {
    expect(
      cosineSimilarity(
        local.embedText("EDICIÓN del montaje"),
        local.embedText("edicion montaje"),
      ),
    ).toBeCloseTo(1);
  });

  it("embeds empty text as a zero vector", async () => {
    const [v] = await local.embed(["  the of  "]);
    expect(v!.every((x) => x === 0)).toBe(true);
  });
});

describe("SiliconFlowEmbeddingProvider", () => {
  function fakeFetch(dims = 3) {
    return jest.fn(async (_url: string, init: { body: string }) => {
      const { input } = JSON.parse(init.body) as { input: string[] };
      // Out of order on purpose: the provider must sort by index.
      const data = input
        .map((_, index) => ({ index, embedding: new Array(dims).fill(index) }))
        .reverse();
      return { ok: true, json: async () => ({ data }) } as unknown as Response;
    });
  }

  it("is only available with an API key", () => {
    expect(new SiliconFlowEmbeddingProvider("").isAvailable()).toBe(false);
    expect(new SiliconFlowEmbeddingProvider("key").isAvailable()).toBe(true);
  });

  it("posts OpenAI-style requests in batches of 32 and keeps the input order", async () => {
    const fetchMock = fakeFetch();
    const provider = new SiliconFlowEmbeddingProvider(
      "key",
      fetchMock as never,
    );
    const texts = Array.from({ length: 40 }, (_, i) => `text ${i}`);

    const vectors = await provider.embed("BAAI/bge-m3", texts);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.siliconflow.com/v1/embeddings");
    expect(
      (init as unknown as { headers: Record<string, string> }).headers
        .Authorization,
    ).toBe("Bearer key");
    expect(JSON.parse((init as { body: string }).body)).toMatchObject({
      model: "BAAI/bge-m3",
      encoding_format: "float",
    });
    expect(vectors).toHaveLength(40);
    expect(vectors[1]).toEqual([1, 1, 1]);
    expect(vectors[32]).toEqual([0, 0, 0]); // first item of the second batch
  });

  it("throws on API errors and on incomplete responses", async () => {
    const failing = jest.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "bad key",
    }));
    await expect(
      new SiliconFlowEmbeddingProvider("key", failing as never).embed("m", [
        "a",
      ]),
    ).rejects.toThrow("Embedding request failed (401): bad key");

    const short = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    }));
    await expect(
      new SiliconFlowEmbeddingProvider("key", short as never).embed("m", ["a"]),
    ).rejects.toThrow("0 vectors for 1 texts");
  });
});

describe("EmbeddingService", () => {
  const model = {
    providerSlug: "siliconflow",
    modelId: "BAAI/bge-m3",
    displayName: "BGE M3",
    creditCost: 2,
  };

  it("uses the admin-activated embedding model when its provider is available", async () => {
    mockPrisma.modelMetadata.findFirst.mockResolvedValue(model);
    const service = new EmbeddingService();
    const embed = jest.fn(async (_m: string, texts: string[]) =>
      texts.map(() => [1]),
    );
    service.registerProvider({
      slug: "siliconflow",
      isAvailable: () => true,
      embed,
    });

    const resolved = await service.resolve();

    expect(mockPrisma.modelMetadata.findFirst).toHaveBeenCalledWith({
      where: { taskType: "embedding", isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    expect(resolved).toMatchObject({
      modelKey: "siliconflow:BAAI/bge-m3",
      creditCost: 2,
      remote: true,
      minSimilarity: REMOTE_EMBEDDING_MIN_SIMILARITY,
    });
    await resolved.embed(["a", "b"]);
    expect(embed).toHaveBeenCalledWith("BAAI/bge-m3", ["a", "b"]);
  });

  it("falls back to the free local embedder without a usable model", async () => {
    const service = new EmbeddingService();
    service.registerProvider({
      slug: "siliconflow",
      isAvailable: () => false,
      embed: jest.fn(),
    });

    mockPrisma.modelMetadata.findFirst.mockResolvedValue(model); // no API key
    expect(await service.resolve()).toMatchObject({
      modelKey: LOCAL_EMBEDDING_MODEL,
      creditCost: 0,
      remote: false,
      minSimilarity: LOCAL_EMBEDDING_MIN_SIMILARITY,
    });

    mockPrisma.modelMetadata.findFirst.mockResolvedValue(null); // none configured
    const local = await service.resolve();
    expect(local.modelKey).toBe(LOCAL_EMBEDDING_MODEL);
    const [vector] = await local.embed(["studio tour"]);
    expect(vector).toHaveLength(LOCAL_EMBEDDING_DIMENSIONS);
  });
});
