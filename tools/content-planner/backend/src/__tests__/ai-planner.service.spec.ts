import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

vi.mock("@creator-hub/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: (await import("./helpers/prisma-mock")).prismaMock,
}));

import {
  LOCAL_EMBEDDING_MIN_SIMILARITY,
  LOCAL_EMBEDDING_MODEL,
  LocalHashEmbeddingProvider,
  type ResolvedEmbedder,
} from "@creator-hub/ai-engine";
import { prismaMock, resetPrismaMock } from "./helpers/prisma-mock";
import {
  AiPlannerService,
  CONTEXT_BUDGET_CHARS,
  PlanningAbortedError,
  type PlanningEvent,
} from "../ai-planner/ai-planner.service";
import { makePdf, upload } from "./helpers/files";

const local = new LocalHashEmbeddingProvider();
const localEmbedder = (): ResolvedEmbedder => ({
  modelKey: LOCAL_EMBEDDING_MODEL,
  displayName: "Local (hashing)",
  creditCost: 0,
  remote: false,
  minSimilarity: LOCAL_EMBEDDING_MIN_SIMILARITY,
  embed: vi.fn(async (texts: string[]) => texts.map((t) => local.embedText(t))),
});

const planReply = {
  title: "Studio tour",
  summary: "Tour of the new studio.",
  platform: "youtube-long",
  complexity: { level: "medium", score: 3, rationale: "Several locations." },
  suggestedPublishInDays: 5,
  steps: [
    {
      name: "Script",
      type: "SCRIPTING",
      durationMinutes: 120,
      description: "Write it",
      tool: {
        toolId: "script-writer",
        intention: "Draft",
        prompt: "Studio tour script",
      },
    },
    {
      name: "Shoot",
      type: "RECORDING",
      durationMinutes: 180,
      description: "Film",
    },
    {
      name: "Thumbnail",
      type: "THUMBNAIL",
      durationMinutes: 45,
      description: "Design",
      tool: {
        toolId: "thumbnail-generator",
        intention: "Make the cover",
        prompt: "Bright studio",
      },
    },
    {
      name: "Publish",
      type: "PUBLISHING",
      durationMinutes: 30,
      description: "Upload",
    },
  ],
};

function setup(options: { embedder?: ResolvedEmbedder; reply?: string } = {}) {
  const textProvider = {
    generate: vi.fn(async () => ({
      output: {
        type: "text",
        content: options.reply ?? JSON.stringify(planReply),
      },
    })),
  };
  const providers = {
    getProviderForModel: vi.fn(async () => textProvider),
    getAnyProviderForTask: vi.fn(() => undefined),
  };
  const embedder = options.embedder ?? localEmbedder();
  const embeddings = { resolve: vi.fn(async () => embedder) };
  const credits = {
    hasEnoughCredits: vi.fn(async () => true),
    deduct: vi.fn(async () => true),
  };
  const usage = { logUsage: vi.fn(async () => undefined) };
  const tools = {
    getActive: () => [
      {
        id: "thumbnail-generator",
        name: "Thumbnail Generator",
        description: "AI thumbnails",
      },
      {
        id: "script-writer",
        name: "Script Writer",
        description: "Video scripts",
      },
      {
        id: "content-planner",
        name: "Content Planner",
        description: "This tool",
      },
    ],
  };
  const knowledge = {
    syncProjectHistory: vi.fn(async () => ({
      digests: new Map([
        [
          "p1",
          {
            projectId: "p1",
            title: "Old tour",
            totalMinutes: 600,
            sessions: 5,
            text: 'Video "Old tour". Total: 10h.',
          },
        ],
      ]),
      embedded: 1,
    })),
    findSimilarProjects: vi.fn(async () => [{ projectId: "p1", score: 0.834 }]),
  };
  const service = new AiPlannerService(
    providers as never,
    embeddings as never,
    credits as never,
    usage as never,
    tools as never,
    knowledge as never,
  );
  return {
    service,
    textProvider,
    providers,
    embedder,
    credits,
    usage,
    knowledge,
  };
}

const baseInput = {
  userId: "u1",
  modelId: "deepseek-ai/DeepSeek-V4",
  idea: "A tour of my new studio with a bright thumbnail",
  language: "en" as const,
  files: [],
};

beforeEach(() => {
  resetPrismaMock();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  prismaMock.modelMetadata.findFirst.mockResolvedValue({
    modelId: "deepseek-ai/DeepSeek-V4",
    displayName: "DeepSeek V4",
    creditCost: 5,
    tier: "FREE",
  });
  prismaMock.user.findUnique.mockResolvedValue({ plan: "FREE" });
  prismaMock.contentAiPlan.create.mockImplementation(
    async ({ data }: { data: object }) => ({ id: "plan1", ...data }),
  );
});

describe("AiPlannerService.analyze", () => {
  it("analyses, retrieves history, plans with the chosen model, saves and charges", async () => {
    const { service, textProvider, credits, usage, knowledge } = setup();
    const events: PlanningEvent[] = [];

    const result = await service.analyze({
      ...baseInput,
      transcript: "also record a voiceover",
      files: [upload("brief.pdf", makePdf(["Shoot the desk and the lights"]))],
      onEvent: (e) => events.push(e),
    });

    expect(events.map((e) => (e.type === "stage" ? e.stage : e.type))).toEqual([
      "reading",
      "indexing",
      "retrieving",
      "analyzing",
      "saving",
      "done",
    ]);
    // The model gets the brief, the RAG evidence and the tool catalogue.
    const request = (
      textProvider.generate.mock.calls[0] as unknown as [
        { model: string; prompt: string; toolId: string },
      ]
    )[0];
    expect(request.model).toBe("deepseek-ai/DeepSeek-V4");
    expect(request.toolId).toBe("content-planner");
    expect(request.prompt).toContain("A tour of my new studio");
    expect(request.prompt).toContain("also record a voiceover");
    expect(request.prompt).toContain(
      "[brief.pdf] Shoot the desk and the lights",
    );
    expect(request.prompt).toContain(
      '1. "Old tour" (similarity 0.83): 10h over 5 sessions',
    );
    expect(request.prompt).toContain("- script-writer (Script Writer)");
    expect(request.prompt).not.toContain("- content-planner"); // never suggests itself
    expect(knowledge.syncProjectHistory).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ modelKey: LOCAL_EMBEDDING_MODEL }),
    );

    expect(result.plan).toMatchObject({
      title: "Studio tour",
      complexity: { level: "medium", score: 3 },
      totalMinutes: 375,
      historyEstimateMinutes: 600,
      similarProductions: [
        {
          projectId: "p1",
          title: "Old tour",
          similarity: 0.83,
          totalMinutes: 600,
          sessions: 5,
        },
      ],
      sources: [{ name: "brief.pdf", kind: "pdf" }],
      model: { id: "deepseek-ai/DeepSeek-V4", name: "DeepSeek V4" },
      embeddingModel: LOCAL_EMBEDDING_MODEL,
      signals: {
        sources: 3,
        mentionedTools: ["thumbnail-generator"],
        similarProductions: 1,
      },
    });
    expect(result.plan.steps.map((s) => s.toolAction?.toolId ?? null)).toEqual([
      "script-writer",
      null,
      "thumbnail-generator",
      null,
    ]);

    // Local embeddings are free: only the model's cost.
    expect(result.creditsCharged).toBe(5);
    expect(credits.hasEnoughCredits).toHaveBeenCalledWith("u1", 5);
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      5,
      "content-planner",
      "AI plan: Studio tour",
    );
    expect(
      prismaMock.contentAiPlan.create.mock.calls[0]![0].data,
    ).toMatchObject({
      userId: "u1",
      modelId: "deepseek-ai/DeepSeek-V4",
      title: "Studio tour",
      complexity: "medium",
      creditsCharged: 5,
      inputSummary: { files: ["brief.pdf"] },
    });
    expect(usage.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: "content-planner",
        success: true,
        credits: 5,
      }),
    );
  });

  it("adds the embedding model's cost when a remote embedder is configured", async () => {
    const remote: ResolvedEmbedder = {
      ...localEmbedder(),
      modelKey: "siliconflow:BAAI/bge-m3",
      remote: true,
      creditCost: 2,
    };
    const { service, credits } = setup({ embedder: remote });
    const result = await service.analyze(baseInput);
    expect(result.creditsCharged).toBe(7);
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      7,
      "content-planner",
      expect.any(String),
    );
  });

  it("needs some input", async () => {
    const { service, textProvider } = setup();
    await expect(
      service.analyze({ ...baseInput, idea: " hi " }),
    ).rejects.toThrow(BadRequestException);
    expect(textProvider.generate).not.toHaveBeenCalled();
  });

  it("rejects inactive/unknown models and PRO models on the free plan", async () => {
    const { service } = setup();
    prismaMock.modelMetadata.findFirst.mockResolvedValueOnce(null);
    await expect(service.analyze(baseInput)).rejects.toThrow(
      "Selected provider is not available",
    );
    expect(prismaMock.modelMetadata.findFirst.mock.calls[0]![0].where).toEqual({
      modelId: "deepseek-ai/DeepSeek-V4",
      isActive: true,
      taskType: "text-generation",
    });

    prismaMock.modelMetadata.findFirst.mockResolvedValue({
      modelId: "pro",
      displayName: "Pro",
      creditCost: 10,
      tier: "PRO",
    });
    await expect(service.analyze(baseInput)).rejects.toThrow(
      ForbiddenException,
    );
    prismaMock.user.findUnique.mockResolvedValue({ plan: "STARTER" });
    await expect(service.analyze(baseInput)).resolves.toMatchObject({
      creditsCharged: 10,
    });
  });

  it("checks the balance before doing any work", async () => {
    const { service, credits, textProvider, knowledge } = setup();
    credits.hasEnoughCredits.mockResolvedValue(false);
    await expect(service.analyze(baseInput)).rejects.toThrow(
      "Insufficient credits. This plan requires 5 credits.",
    );
    expect(knowledge.syncProjectHistory).not.toHaveBeenCalled();
    expect(textProvider.generate).not.toHaveBeenCalled();
    expect(credits.deduct).not.toHaveBeenCalled();
  });

  it("does not charge or save when the model's reply is not a plan", async () => {
    const { service, credits, usage } = setup({
      reply: "Sorry, I can't do that.",
    });
    await expect(service.analyze(baseInput)).rejects.toThrow(
      "The model didn't return a valid plan. Try again or choose another model.",
    );
    expect(credits.deduct).not.toHaveBeenCalled();
    expect(prismaMock.contentAiPlan.create).not.toHaveBeenCalled();
    expect(usage.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, credits: 0 }),
    );
  });

  it("removes the saved plan when the charge fails (balance spent meanwhile)", async () => {
    const { service, credits } = setup();
    credits.deduct.mockResolvedValue(false);
    await expect(service.analyze(baseInput)).rejects.toThrow(
      "Insufficient credits",
    );
    expect(prismaMock.contentAiPlan.delete).toHaveBeenCalledWith({
      where: { id: "plan1" },
    });
  });

  it("stops without charging when the client goes away", async () => {
    const { service, credits } = setup();
    const controller = new AbortController();
    const run = service.analyze({
      ...baseInput,
      signal: controller.signal,
      onEvent: (e) =>
        e.type === "stage" && e.stage === "indexing" && controller.abort(),
    });
    await expect(run).rejects.toBeInstanceOf(PlanningAbortedError);
    expect(credits.deduct).not.toHaveBeenCalled();
    expect(prismaMock.contentAiPlan.create).not.toHaveBeenCalled();
  });

  it("sends only the most relevant excerpts of long documents (vector retrieval)", async () => {
    const { service, textProvider } = setup();
    const filler = Array.from(
      { length: 40 },
      (_, i) =>
        `Accounting appendix ${i}: spreadsheets, invoices and quarterly tax tables.`,
    ).join("\n\n");
    const relevant =
      "Kitchen scene: film the recipe on the stove, close-up of the sauce.";
    await service.analyze({
      ...baseInput,
      idea: "Cooking recipe video: film the kitchen stove scene",
      files: [
        upload("long.txt", `${filler}\n\n${relevant}\n\n${filler}`.repeat(3)),
      ],
    });
    const prompt = (
      textProvider.generate.mock.calls[0] as unknown as [{ prompt: string }]
    )[0].prompt;
    const docPart = prompt.slice(
      prompt.indexOf("Documents (most relevant excerpts):"),
    );
    expect(docPart).toContain("Kitchen scene: film the recipe");
    expect(docPart.length).toBeLessThan(CONTEXT_BUDGET_CHARS + 500);
  });
});

describe("estimate & plans", () => {
  it("estimates the cost of a run", async () => {
    const remote: ResolvedEmbedder = {
      ...localEmbedder(),
      displayName: "BGE M3",
      remote: true,
      creditCost: 1,
    };
    const { service } = setup({ embedder: remote });
    expect(await service.estimate("u1", "deepseek-ai/DeepSeek-V4")).toEqual({
      modelId: "deepseek-ai/DeepSeek-V4",
      modelName: "DeepSeek V4",
      modelCost: 5,
      embeddingModel: "BGE M3",
      embeddingCost: 1,
      total: 6,
    });
  });

  it("returns only the user's own plans", async () => {
    const { service } = setup();
    prismaMock.contentAiPlan.findFirst.mockResolvedValue(null);
    await expect(service.getPlan("u1", "other")).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.contentAiPlan.findFirst).toHaveBeenCalledWith({
      where: { id: "other", userId: "u1" },
    });
  });

  it("lists the tools a plan may suggest, without itself", () => {
    expect(
      setup()
        .service.availableTools()
        .map((t) => t.id),
    ).toEqual(["thumbnail-generator", "script-writer"]);
  });
});
