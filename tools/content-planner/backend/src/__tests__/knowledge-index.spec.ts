import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: (await import("./helpers/prisma-mock")).prismaMock,
}));

import {
  LOCAL_EMBEDDING_MIN_SIMILARITY,
  LOCAL_EMBEDDING_MODEL,
  LocalHashEmbeddingProvider,
  cosineSimilarity,
  type ResolvedEmbedder,
} from "@creator-hub/ai-engine";
import { prismaMock, resetPrismaMock } from "./helpers/prisma-mock";
import {
  digestProject,
  hashText,
  KnowledgeIndexService,
} from "../ai-planner/knowledge-index.service";

const local = new LocalHashEmbeddingProvider();
const embedder = (): ResolvedEmbedder & {
  embed: ReturnType<typeof vi.fn>;
} => ({
  modelKey: LOCAL_EMBEDDING_MODEL,
  displayName: "Local",
  creditCost: 0,
  remote: false,
  minSimilarity: LOCAL_EMBEDDING_MIN_SIMILARITY,
  embed: vi.fn(async (texts: string[]) => texts.map((t) => local.embedText(t))),
});

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 2, 2, h, m));
const session = (
  type: string,
  from: number,
  to: number,
  status = "PLANNED",
  customType: { name: string } | null = null,
) => ({
  type,
  status,
  startAt: at(from),
  endAt: at(to),
  customType,
});
const project = (
  id: string,
  title: string,
  events: ReturnType<typeof session>[],
  extra = {},
) => ({
  id,
  title,
  platform: "youtube-long",
  notes: null,
  customPlatform: null,
  events,
  ...extra,
});

const service = new KnowledgeIndexService();

beforeEach(() => {
  resetPrismaMock();
  prismaMock.contentKnowledgeChunk.findMany.mockResolvedValue([]);
});

describe("digestProject", () => {
  it("summarises a production, skipping cancelled sessions", () => {
    const digest = digestProject(
      project(
        "p1",
        "Studio tour",
        [
          session("IDEATION", 9, 10, "DONE"),
          session("OTHER", 10, 12, "PLANNED", { name: "Voiceover" }),
          session("EDITING", 13, 17, "CANCELLED"),
        ],
        { customPlatform: { name: "Kick" }, notes: "Show the lights" },
      ),
    );
    expect(digest).toEqual({
      projectId: "p1",
      title: "Studio tour",
      totalMinutes: 180,
      sessions: 2,
      topic: "Studio tour. Show the lights",
      text: 'Video "Studio tour" for Kick. Notes: Show the lights Production: Ideation 1h (done), Voiceover 2h. Total: 3h across 2 sessions.',
    });
  });

  it("embeds only the topic: unrelated productions don't look alike", () => {
    const a = digestProject(
      project("a", "Gaming setup tour", [session("RECORDING", 9, 13)]),
    )!;
    const b = digestProject(
      project("b", "Sourdough for beginners", [session("RECORDING", 9, 13)]),
    )!;
    expect(a.topic).toBe("Gaming setup tour");
    // The full summaries share their whole structure…
    expect(
      cosineSimilarity(local.embedText(a.text), local.embedText(b.text)),
    ).toBeGreaterThan(LOCAL_EMBEDDING_MIN_SIMILARITY);
    // …the topics don't.
    expect(
      cosineSimilarity(local.embedText(a.topic), local.embedText(b.topic)),
    ).toBeLessThan(LOCAL_EMBEDDING_MIN_SIMILARITY);
  });

  it("ignores productions without active sessions", () => {
    expect(
      digestProject(
        project("p1", "Empty", [session("EDITING", 9, 10, "CANCELLED")]),
      ),
    ).toBeNull();
  });
});

describe("syncProjectHistory", () => {
  it("embeds new and changed productions only, and drops deleted ones", async () => {
    const unchanged = project("p1", "Cooking show", [
      session("RECORDING", 9, 12),
    ]);
    const changed = project("p2", "Studio tour", [session("EDITING", 9, 13)]);
    const brandNew = project("p3", "Podcast", [session("RECORDING", 9, 10)]);
    prismaMock.contentProject.findMany.mockResolvedValue([
      unchanged,
      changed,
      brandNew,
    ]);
    prismaMock.contentKnowledgeChunk.findMany.mockResolvedValue([
      {
        id: "c1",
        sourceId: "p1",
        contentHash: hashText(digestProject(unchanged)!.topic),
        content: digestProject(unchanged)!.text,
      },
      { id: "c2", sourceId: "p2", contentHash: "outdated", content: "" },
      { id: "c9", sourceId: "deleted-project", contentHash: "x", content: "" },
    ]);
    const e = embedder();

    const { digests, embedded } = await service.syncProjectHistory("u1", e);

    expect(embedded).toBe(2);
    expect(e.embed).toHaveBeenCalledTimes(1);
    expect(e.embed.mock.calls[0]![0]).toEqual([
      digestProject(changed)!.topic,
      digestProject(brandNew)!.topic,
    ]);
    expect(prismaMock.contentKnowledgeChunk.upsert).toHaveBeenCalledTimes(2);
    expect(
      prismaMock.contentKnowledgeChunk.upsert.mock.calls[0]![0],
    ).toMatchObject({
      where: {
        chunkSource: {
          userId: "u1",
          sourceType: "project",
          sourceId: "p2",
          embeddingModel: LOCAL_EMBEDDING_MODEL,
        },
      },
      update: {
        content: digestProject(changed)!.text,
        contentHash: hashText(digestProject(changed)!.topic),
      },
    });
    expect(prismaMock.contentKnowledgeChunk.update).not.toHaveBeenCalled();
    // Deleted projects and vectors of other embedding models are removed.
    expect(prismaMock.contentKnowledgeChunk.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        sourceType: "project",
        OR: [
          { id: { in: ["c9"] } },
          { embeddingModel: { not: LOCAL_EMBEDDING_MODEL } },
        ],
      },
    });
    expect([...digests.keys()]).toEqual(["p1", "p2", "p3"]);
    // Scoped to the user's 50 most recent productions and to this model.
    expect(prismaMock.contentProject.findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: "u1" },
      take: 50,
    });
    expect(
      prismaMock.contentKnowledgeChunk.findMany.mock.calls[0]![0].where,
    ).toEqual({
      userId: "u1",
      sourceType: "project",
      embeddingModel: LOCAL_EMBEDDING_MODEL,
    });
  });

  it("embeds nothing when every topic is indexed", async () => {
    const p = project("p1", "Cooking show", [session("RECORDING", 9, 12)]);
    prismaMock.contentProject.findMany.mockResolvedValue([p]);
    prismaMock.contentKnowledgeChunk.findMany.mockResolvedValue([
      {
        id: "c1",
        sourceId: "p1",
        contentHash: hashText(digestProject(p)!.topic),
        content: digestProject(p)!.text,
      },
    ]);
    const e = embedder();
    expect((await service.syncProjectHistory("u1", e)).embedded).toBe(0);
    expect(e.embed).not.toHaveBeenCalled();
    expect(prismaMock.contentKnowledgeChunk.upsert).not.toHaveBeenCalled();
    expect(prismaMock.contentKnowledgeChunk.update).not.toHaveBeenCalled();
    // Only the (cheap) cleanup of other models' vectors runs.
    expect(prismaMock.contentKnowledgeChunk.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "u1",
        sourceType: "project",
        OR: [{ embeddingModel: { not: LOCAL_EMBEDDING_MODEL } }],
      },
    });
  });

  it("new sessions on the same topic refresh the summary without re-embedding", async () => {
    const before = project("p1", "Cooking show", [session("RECORDING", 9, 12)]);
    const after = project("p1", "Cooking show", [
      session("RECORDING", 9, 12),
      session("EDITING", 13, 17),
    ]);
    prismaMock.contentProject.findMany.mockResolvedValue([after]);
    prismaMock.contentKnowledgeChunk.findMany.mockResolvedValue([
      {
        id: "c1",
        sourceId: "p1",
        contentHash: hashText(digestProject(before)!.topic),
        content: digestProject(before)!.text,
      },
    ]);
    const e = embedder();
    const { digests, embedded } = await service.syncProjectHistory("u1", e);
    expect(embedded).toBe(0);
    expect(e.embed).not.toHaveBeenCalled();
    expect(prismaMock.contentKnowledgeChunk.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { content: digestProject(after)!.text },
    });
    expect(digests.get("p1")!.totalMinutes).toBe(420);
  });
});

describe("findSimilarProjects", () => {
  it("ranks the user's productions by cosine similarity, above the embedder's threshold", async () => {
    const vector = (t: string) => local.embedText(t);
    prismaMock.contentKnowledgeChunk.findMany.mockResolvedValue([
      {
        sourceId: "cooking",
        embedding: vector(
          "Cooking recipe video, filming in the kitchen and editing",
        ),
      },
      {
        sourceId: "tax",
        embedding: vector("Quarterly accounting tax spreadsheet"),
      },
      {
        sourceId: "baking",
        embedding: vector("Baking recipe video for YouTube"),
      },
    ]);

    const hits = await service.findSimilarProjects(
      "u1",
      embedder(),
      vector("recipe video: kitchen filming"),
    );

    expect(hits.map((h) => h.projectId)).toEqual(["cooking", "baking"]);
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
  });

  it("uses the embedder's own threshold", async () => {
    prismaMock.contentKnowledgeChunk.findMany.mockResolvedValue([
      { sourceId: "half", embedding: [0.6, 0.8] },
      { sourceId: "close", embedding: [1, 0] },
    ]);
    const strict = { ...embedder(), minSimilarity: 0.9 };
    expect(
      (await service.findSimilarProjects("u1", strict, [1, 0])).map(
        (h) => h.projectId,
      ),
    ).toEqual(["close"]);
    const loose = { ...embedder(), minSimilarity: 0.5 };
    expect(
      (await service.findSimilarProjects("u1", loose, [1, 0])).map(
        (h) => h.projectId,
      ),
    ).toEqual(["close", "half"]);
  });
});
