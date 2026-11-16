/**
 * AI planner integration test — runs against a REAL PostgreSQL database:
 * the vector index (ContentKnowledgeChunk, real[] embeddings), the atomic
 * credit debit (CreditService → CreditTransaction), the saved plan and
 * "Add to calendar" (project + sessions with tool actions). Only the text
 * model is stubbed.
 *
 *   DATABASE_URL=postgresql://... npx vitest --run src/__tests__/ai-planner.integration.spec.ts
 *
 * Skipped when DATABASE_URL is unset or the schema isn't applied.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@creator-hub/database";
import {
  EmbeddingService,
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_MODEL,
} from "@creator-hub/ai-engine";
import { CreditService } from "@creator-hub/billing";
import { AiPlannerService } from "../ai-planner/ai-planner.service";
import { KnowledgeIndexService } from "../ai-planner/knowledge-index.service";
import { ContentPlannerService } from "../content-planner.service";
import { makePdf, upload } from "./helpers/files";

let dbReady = false;
const run = `it-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const userId = `user-${run}`;
const modelId = `test/planner-${run}`;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "ContentAiPlan", "ContentKnowledgeChunk", "ModelMetadata" LIMIT 1`,
    );
    dbReady = true;
  } catch {
    return; // unreachable DB or schema not applied
  }
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  await prisma.user.create({
    data: { id: userId, email: `${run}@example.com`, currentCredits: 50 },
  });
  await prisma.modelMetadata.create({
    data: {
      providerSlug: "siliconflow",
      modelId,
      displayName: "Test planner model",
      taskType: "text-generation",
      tier: "FREE",
      creditCost: 4,
      isActive: true,
      isCustom: true,
    },
  });
  // An unrelated past production the search must NOT return.
  await prisma.contentProject.create({
    data: {
      userId,
      title: "Gaming setup tour",
      events: {
        create: [
          {
            userId,
            title: "Film the desk",
            type: "RECORDING",
            startAt: new Date("2026-01-02T10:00:00Z"),
            endAt: new Date("2026-01-02T11:00:00Z"),
          },
        ],
      },
    },
  });
  // A past production the vector search should find.
  await prisma.contentProject.create({
    data: {
      userId,
      title: "Kitchen recipe video",
      events: {
        create: [
          {
            userId,
            title: "Film the recipe",
            type: "RECORDING",
            status: "DONE",
            startAt: new Date("2026-01-05T10:00:00Z"),
            endAt: new Date("2026-01-05T13:00:00Z"),
          },
          {
            userId,
            title: "Edit the recipe",
            type: "EDITING",
            startAt: new Date("2026-01-06T10:00:00Z"),
            endAt: new Date("2026-01-06T14:00:00Z"),
          },
        ],
      },
    },
  });
}, 30_000);

afterAll(async () => {
  if (!dbReady) return;
  await prisma.user.deleteMany({ where: { id: userId } }); // cascades
  await prisma.modelMetadata.deleteMany({ where: { modelId } });
});

const planReply = JSON.stringify({
  title: "Pasta recipe video",
  complexity: {
    level: "medium",
    score: 3,
    rationale: "One location, two dishes.",
  },
  suggestedPublishInDays: 4,
  steps: [
    {
      name: "Film",
      type: "RECORDING",
      durationMinutes: 180,
      description: "Film the kitchen scenes",
    },
    {
      name: "Cover",
      type: "THUMBNAIL",
      durationMinutes: 45,
      tool: {
        toolId: "thumbnail-generator",
        intention: "Make the cover",
        prompt: "Steaming pasta, bright kitchen",
      },
    },
    { name: "Publish", type: "PUBLISHING", durationMinutes: 30 },
  ],
});

function planner() {
  const generate = vi.fn(async () => ({
    output: { type: "text", content: planReply },
  }));
  const service = new AiPlannerService(
    {
      getProviderForModel: async () => ({ generate }),
      getAnyProviderForTask: () => undefined,
    } as never,
    new EmbeddingService(),
    new CreditService({ add: vi.fn() } as never, { emit: vi.fn() } as never),
    { logUsage: vi.fn(async () => undefined) } as never,
    {
      getActive: () => [
        {
          id: "thumbnail-generator",
          name: "Thumbnail Generator",
          description: "AI thumbnails",
        },
      ],
    } as never,
    new KnowledgeIndexService(),
  );
  return { service, generate };
}

describe("AI planner against PostgreSQL", () => {
  it("indexes history as vectors, retrieves it, charges atomically and saves the plan", async (ctx) => {
    if (!dbReady) ctx.skip();
    const { service, generate } = planner();

    const result = await service.analyze({
      userId,
      modelId,
      idea: "A pasta recipe video filmed in my kitchen",
      language: "en",
      files: [
        upload(
          "shot-list.pdf",
          makePdf(["Close-up of the sauce", "Wide kitchen shot"]),
        ),
      ],
    });

    // Vector index: one 384-d embedding per past production.
    const chunks = await prisma.contentKnowledgeChunk.findMany({
      where: { userId },
    });
    expect(chunks).toHaveLength(2);
    for (const chunk of chunks) {
      expect(chunk).toMatchObject({
        sourceType: "project",
        embeddingModel: LOCAL_EMBEDDING_MODEL,
      });
      expect(chunk.embedding).toHaveLength(LOCAL_EMBEDDING_DIMENSIONS);
    }

    // Retrieval found the related one only, and the model saw it.
    expect(result.plan.similarProductions).toEqual([
      expect.objectContaining({
        title: "Kitchen recipe video",
        totalMinutes: 420,
        sessions: 2,
      }),
    ]);
    const prompt = (
      generate.mock.calls[0] as unknown as [{ prompt: string }]
    )[0].prompt;
    expect(prompt).toContain('"Kitchen recipe video"');
    expect(prompt).toContain("[shot-list.pdf] Close-up of the sauce");

    // Atomic debit + transaction row.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.currentCredits).toBe(46);
    const txn = await prisma.creditTransaction.findFirstOrThrow({
      where: { userId },
    });
    expect(txn).toMatchObject({
      amount: -4,
      type: "USAGE",
      balance: 46,
      description: "AI plan: Pasta recipe video",
    });

    // Saved plan.
    const saved = await prisma.contentAiPlan.findUniqueOrThrow({
      where: { id: result.planId },
    });
    expect(saved).toMatchObject({
      status: "ANALYZED",
      creditsCharged: 4,
      complexity: "medium",
    });
    expect((saved.result as { steps: unknown[] }).steps).toHaveLength(3);
  }, 30_000);

  it("only re-embeds productions that changed, and drops other models' vectors", async (ctx) => {
    if (!dbReady) ctx.skip();
    const before = await prisma.contentKnowledgeChunk.findMany({
      where: { userId },
      orderBy: { sourceId: "asc" },
    });
    // Left over from a previously configured embedding model.
    await prisma.contentKnowledgeChunk.create({
      data: {
        userId,
        sourceType: "project",
        sourceId: before[0]!.sourceId,
        content: "old",
        contentHash: "old",
        embedding: [0.1, 0.2],
        embeddingModel: "siliconflow:old-model",
      },
    });
    const embedder = await new EmbeddingService().resolve();

    expect(
      (await new KnowledgeIndexService().syncProjectHistory(userId, embedder))
        .embedded,
    ).toBe(0);
    const after = await prisma.contentKnowledgeChunk.findMany({
      where: { userId },
      orderBy: { sourceId: "asc" },
    });
    expect(after.map((c) => [c.id, c.updatedAt])).toEqual(
      before.map((c) => [c.id, c.updatedAt]),
    );
  });

  it("adds the plan to the calendar with its tool actions and marks it applied", async (ctx) => {
    if (!dbReady) ctx.skip();
    const plan = await prisma.contentAiPlan.findFirstOrThrow({
      where: { userId },
    });

    const { project } = await new ContentPlannerService().createProject(
      userId,
      {
        title: "Pasta recipe video",
        aiPlanId: plan.id,
        events: [
          {
            title: "Cover: Pasta recipe video",
            type: "THUMBNAIL",
            startAt: "2030-03-05T10:00:00.000Z",
            endAt: "2030-03-05T10:45:00.000Z",
            toolAction: {
              toolId: "thumbnail-generator",
              intention: "Make the cover",
              prompt: "Steaming pasta",
            },
          },
        ],
      },
    );

    const event = await prisma.contentEvent.findFirstOrThrow({
      where: { projectId: project.id },
    });
    expect(event.toolAction).toEqual({
      toolId: "thumbnail-generator",
      intention: "Make the cover",
      prompt: "Steaming pasta",
    });
    const applied = await prisma.contentAiPlan.findUniqueOrThrow({
      where: { id: plan.id },
    });
    expect(applied).toMatchObject({ status: "APPLIED", projectId: project.id });
  });
});
