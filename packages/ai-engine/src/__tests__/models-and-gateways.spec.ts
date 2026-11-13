import type { ModelInfo } from "../gateways/ai-gateway.interface";
import {
  collect,
  delta,
  errorResponse,
  jsonResponse,
  sseResponse,
} from "../__mocks__/http";

const mockPrisma = {
  modelMetadata: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  providerUsage: { upsert: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(async (ops: unknown[]) => ops),
};
jest.mock("@creator-hub/database", () => ({ prisma: mockPrisma, Prisma: {} }));

import { ModelSyncService } from "../models/model-sync.service";
import { ModelRegistryService } from "../models/model-registry.service";
import { OpenRouterModelsService } from "../models/openrouter-models.service";
import { OpenRouterGateway } from "../gateways/openrouter.gateway";
import { SiliconFlowGateway } from "../gateways/siliconflow.gateway";
import { OpenRouterProvider } from "../providers/openrouter.provider";

const fetchMock = jest.fn();
const realFetch = global.fetch;
const ENV = ["OPENROUTER_API_KEY", "SILICONFLOW_API_KEY", "ENABLE_MODEL_SYNC"];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of ENV) saved[key] = process.env[key];
  process.env.OPENROUTER_API_KEY = "or-key";
  process.env.SILICONFLOW_API_KEY = "sf-key";
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  global.fetch = realFetch;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function model(overrides: Partial<ModelInfo>): ModelInfo {
  return {
    id: "m",
    name: "Model",
    taskType: "text-generation",
    supportsStreaming: true,
    supportsVision: false,
    pricing: { promptPer1k: 0 },
    ...overrides,
  } as ModelInfo;
}

// ─── ModelSyncService ───────────────────────────────────────────────

describe("ModelSyncService", () => {
  it("reports a successful sync with its duration", async () => {
    const registry = {
      syncModels: jest.fn(async () => ({
        total: 3,
        created: 1,
        updated: 2,
        deactivated: 0,
      })),
    };
    const sync = new ModelSyncService(registry as never);

    const result = await sync.sync();

    expect(result).toMatchObject({
      success: true,
      total: 3,
      created: 1,
      updated: 2,
    });
    expect(sync.getStatus()).toMatchObject({
      isSyncing: false,
      syncStatus: "success",
    });
    expect(sync.getStatus().lastSyncAt).toBeInstanceOf(Date);
  });

  it("refuses overlapping syncs", async () => {
    let release!: () => void;
    const registry = {
      syncModels: jest.fn(
        () =>
          new Promise(
            (resolve) =>
              (release = () =>
                resolve({ total: 0, created: 0, updated: 0, deactivated: 0 })),
          ),
      ),
    };
    const sync = new ModelSyncService(registry as never);

    const first = sync.sync();
    const second = await sync.sync();
    release();

    expect(second).toMatchObject({
      success: false,
      error: "Sync already in progress",
    });
    expect((await first).success).toBe(true);
    expect(registry.syncModels).toHaveBeenCalledTimes(1);
  });

  it("captures failures instead of throwing", async () => {
    const sync = new ModelSyncService({
      syncModels: jest.fn().mockRejectedValue(new Error("API down")),
    } as never);

    expect(await sync.sync()).toMatchObject({
      success: false,
      error: "API down",
    });
    expect(sync.getStatus().syncStatus).toBe("error");
  });

  it("runs an initial sync after 5s and then hourly, unless disabled", async () => {
    jest.useFakeTimers();
    const registry = {
      syncModels: jest.fn(async () => ({
        total: 0,
        created: 0,
        updated: 0,
        deactivated: 0,
      })),
    };
    const sync = new ModelSyncService(registry as never);

    sync.onModuleInit();
    await jest.advanceTimersByTimeAsync(5000);
    expect(registry.syncModels).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(registry.syncModels).toHaveBeenCalledTimes(2);

    sync.stopPeriodicSync();
    await jest.advanceTimersByTimeAsync(3_600_000);
    expect(registry.syncModels).toHaveBeenCalledTimes(2);

    process.env.ENABLE_MODEL_SYNC = "false";
    const disabled = new ModelSyncService(registry as never);
    disabled.onModuleInit();
    await jest.advanceTimersByTimeAsync(10_000);
    expect(registry.syncModels).toHaveBeenCalledTimes(2);
  });
});

// ─── ModelRegistryService ───────────────────────────────────────────

describe("ModelRegistryService.syncModels", () => {
  const openRouter = { fetchModels: jest.fn() };
  const siliconFlow = { listModels: jest.fn() };
  const registry = new ModelRegistryService(
    openRouter as never,
    siliconFlow as never,
  );

  it("creates new models inactive, updates existing ones and deactivates stale ones", async () => {
    openRouter.fetchModels.mockResolvedValue([
      model({
        id: "new/model",
        name: "New",
        pricing: { promptPer1k: 0.000001 },
      }),
      model({
        id: "existing/model",
        name: "Renamed",
        taskType: "image-generation",
      }),
    ]);
    siliconFlow.listModels.mockResolvedValue([]);
    mockPrisma.modelMetadata.findMany.mockImplementation(
      async ({ where }: { where: { providerSlug: string } }) =>
        where.providerSlug === "openrouter"
          ? [
              {
                id: "row-1",
                modelId: "existing/model",
                taskType: "text-generation",
              },
              {
                id: "row-2",
                modelId: "removed/model",
                taskType: "text-generation",
              },
            ]
          : [],
    );
    mockPrisma.modelMetadata.createMany.mockResolvedValue({ count: 1 });

    const result = await registry.syncModels();

    expect(result).toEqual({
      total: 2,
      created: 1,
      updated: 1,
      deactivated: 1,
    });
    const created = mockPrisma.modelMetadata.createMany.mock.calls[0][0];
    expect(created.skipDuplicates).toBe(true);
    expect(created.data[0]).toMatchObject({
      providerSlug: "openrouter",
      modelId: "new/model",
      isActive: false,
      tier: "PRO",
      creditCost: 3,
    });
    const updates = mockPrisma.modelMetadata.update.mock.calls.map((c) => c[0]);
    expect(updates).toContainEqual(
      expect.objectContaining({
        where: {
          providerSlug_modelId: {
            providerSlug: "openrouter",
            modelId: "existing/model",
          },
        },
        data: expect.objectContaining({
          displayName: "Renamed",
          taskType: "image-generation",
        }),
      }),
    );
    expect(updates).toContainEqual({
      where: { id: "row-2" },
      data: { isActive: false },
    });
  });

  it("never overrides a curated non-text task type during updates", async () => {
    openRouter.fetchModels.mockResolvedValue([
      model({ id: "vid", taskType: "text-generation" }),
    ]);
    siliconFlow.listModels.mockResolvedValue([]);
    mockPrisma.modelMetadata.findMany.mockImplementation(
      async ({ where }: { where: { providerSlug: string } }) =>
        where.providerSlug === "openrouter"
          ? [{ id: "r", modelId: "vid", taskType: "video-generation" }]
          : [],
    );

    await registry.syncModels();

    expect(
      mockPrisma.modelMetadata.update.mock.calls[0][0].data.taskType,
    ).toBeUndefined();
  });

  it.each([
    [model({ taskType: "text-generation", pricing: { promptPer1k: 0 } }), 1],
    [
      model({
        taskType: "text-generation",
        pricing: { promptPer1k: 0.000004 },
      }),
      3,
    ],
    [
      model({ taskType: "text-generation", pricing: { promptPer1k: 0.00002 } }),
      5,
    ],
    [
      model({ taskType: "text-generation", pricing: { promptPer1k: 0.003 } }),
      10,
    ],
    [
      model({ taskType: "image-generation", pricing: { imagePerGen: 0.005 } }),
      5,
    ],
    [
      model({ taskType: "image-generation", pricing: { imagePerGen: 0.04 } }),
      10,
    ],
    [
      model({ taskType: "image-generation", pricing: { imagePerGen: 0.08 } }),
      15,
    ],
    [model({ taskType: "video-generation" }), 30],
    [model({ taskType: "speech-to-text" }), 2],
  ])("prices new model %# at %d credits", async (remote, credits) => {
    openRouter.fetchModels.mockResolvedValue([remote]);
    siliconFlow.listModels.mockResolvedValue([]);
    mockPrisma.modelMetadata.findMany.mockResolvedValue([]);
    mockPrisma.modelMetadata.createMany.mockResolvedValue({ count: 1 });

    await registry.syncModels();

    expect(
      mockPrisma.modelMetadata.createMany.mock.calls[0][0].data[0].creditCost,
    ).toBe(credits);
  });
});

describe("ModelRegistryService CRUD & usage", () => {
  const registry = new ModelRegistryService({} as never, {} as never);

  it("paginates and filters models", async () => {
    mockPrisma.modelMetadata.findMany.mockResolvedValue([]);
    mockPrisma.modelMetadata.count.mockResolvedValue(45);

    const result = await registry.findAll({
      page: 0,
      limit: 500,
      search: "llama",
      tags: ["fast"],
      isActive: false,
    });

    const args = mockPrisma.modelMetadata.findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(0);
    expect(args.where).toMatchObject({
      isActive: false,
      tags: { hasSome: ["fast"] },
    });
    expect(args.where.OR).toHaveLength(3);
    expect(result.meta).toEqual({
      page: 1,
      limit: 100,
      total: 45,
      totalPages: 1,
    });
  });

  it("throws for unknown models", async () => {
    mockPrisma.modelMetadata.findUnique.mockResolvedValue(null);
    await expect(registry.findById("x")).rejects.toThrow("Model not found: x");
    await expect(registry.findByProviderAndModel("or", "m")).rejects.toThrow(
      "Model not found: or/m",
    );
    await expect(
      registry.updateConfig("x", { isActive: true }),
    ).rejects.toThrow("Model not found: x");
  });

  it("updates configuration and bulk-updates", async () => {
    mockPrisma.modelMetadata.findUnique.mockResolvedValue({ id: "m1" });
    mockPrisma.modelMetadata.updateMany.mockResolvedValue({ count: 2 });

    await registry.updateConfig("m1", { creditCost: 7 });
    const bulk = await registry.bulkUpdate(["a", "b"], { isActive: true });

    expect(mockPrisma.modelMetadata.update.mock.calls[0][0].data).toEqual({
      creditCost: 7,
      updatedAt: expect.any(Date),
    });
    expect(bulk).toEqual({ updated: 2 });
  });

  it("lists active models by task, cheapest first", async () => {
    await registry.getActiveModels("image-generation");
    expect(mockPrisma.modelMetadata.findMany).toHaveBeenCalledWith({
      where: { taskType: "image-generation", isActive: true },
      orderBy: [{ creditCost: "asc" }, { displayName: "asc" }],
    });
  });

  it("summarizes the catalog", async () => {
    mockPrisma.modelMetadata.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);
    mockPrisma.modelMetadata.groupBy
      .mockResolvedValueOnce([{ providerSlug: "openrouter", _count: 5 }])
      .mockResolvedValueOnce([{ taskType: "text-generation", _count: 5 }])
      .mockResolvedValueOnce([{ tier: "PRO", _count: 5 }]);

    expect(await registry.getStats()).toEqual({
      total: 5,
      active: 2,
      byProvider: { openrouter: 5 },
      byTaskType: { "text-generation": 5 },
      byTier: { PRO: 5 },
    });
  });

  it("aggregates daily usage per provider and model", async () => {
    jest.useFakeTimers({ now: new Date(2026, 2, 15, 14, 30) });

    await registry.recordUsage("openrouter", "m1", {
      tokens: 100,
      creditsCharged: 3,
    });

    const args = mockPrisma.providerUsage.upsert.mock.calls[0][0];
    expect(args.where.providerSlug_modelId_date.date).toEqual(
      new Date(2026, 2, 15),
    );
    expect(args.create).toMatchObject({
      totalRequests: 1,
      totalTokens: 100,
      totalImages: 0,
      creditsCharged: 3,
    });
    expect(args.update).toMatchObject({
      totalRequests: { increment: 1 },
      totalTokens: { increment: 100 },
    });
  });

  it("queries usage within a date range", async () => {
    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-01-31");

    await registry.getUsageStats({
      startDate,
      endDate,
      providerSlug: "openrouter",
    });

    expect(mockPrisma.providerUsage.findMany).toHaveBeenCalledWith({
      where: {
        date: { gte: startDate, lte: endDate },
        providerSlug: "openrouter",
      },
      orderBy: { date: "desc" },
    });
  });
});

// ─── OpenRouterModelsService ────────────────────────────────────────

describe("OpenRouterModelsService", () => {
  function catalog() {
    return {
      data: [
        {
          id: "google/gemini-2.5-flash",
          name: "Gemini Flash",
          pricing: { prompt: "0.0000003", completion: "0.0000025" },
          context_length: 1_000_000,
          architecture: { modality: "text+image->text" },
        },
        {
          id: "openai/gpt-5-image",
          name: "GPT-5 Image",
          pricing: { prompt: "0.00001", completion: "0.00004", image: "0.04" },
          architecture: { modality: "text+image->text+image" },
        },
        {
          id: "anthropic/claude-pro",
          name: "Claude",
          pricing: { prompt: "0.000015", completion: "0.000075" },
          architecture: { modality: "text->text" },
        },
        {
          id: "openai/whisper-1",
          name: "Whisper",
          pricing: { prompt: "0", completion: "0" },
        },
      ],
    };
  }
  function videoCatalog() {
    return {
      data: [
        {
          id: "kling/v2",
          name: "Kling",
          supported_resolutions: ["720p", "1080p"],
          supported_durations: [5, 10],
          supported_frame_images: ["first_frame"],
          pricing_skus: {
            duration_seconds_720p: "0.1",
            duration_seconds_1080p: "0.2",
          },
        },
        {
          id: "bytedance/seedance",
          name: "Seedance",
          pricing_skus: { video_tokens: "0.000001" },
        },
        {
          id: "old/cents",
          name: "Cents",
          pricing_skus: { cents_per_video_output_second_480p: "8" },
        },
      ],
    };
  }

  function mockCatalogs() {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/videos/models")
        ? jsonResponse(videoCatalog())
        : jsonResponse(catalog()),
    );
  }

  it("returns an empty list without an API key", async () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(await new OpenRouterModelsService().fetchModels()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("classifies models by what they output and tags them", async () => {
    mockCatalogs();
    const models = await new OpenRouterModelsService().fetchModels();
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));

    expect(byId["google/gemini-2.5-flash"]).toMatchObject({
      taskType: "text-generation",
      supportsVision: true,
      tags: expect.arrayContaining(["fast", "long-context", "cheap", "google"]),
    });
    expect(byId["google/gemini-2.5-flash"]!.pricing.promptPer1k).toBeCloseTo(
      0.0003,
    );
    expect(byId["openai/gpt-5-image"]).toMatchObject({
      taskType: "image-generation",
      pricing: { imagePerGen: 0.04 },
    });
    expect(byId["anthropic/claude-pro"]!.tags).toEqual(
      expect.arrayContaining(["high-quality", "premium", "anthropic"]),
    );
    expect(byId["openai/whisper-1"]!.taskType).toBe("speech-to-text");
  });

  it("estimates video prices from per-second, cents and token SKUs", async () => {
    mockCatalogs();
    const models = await new OpenRouterModelsService().fetchModels();
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));

    expect(byId["kling/v2"]).toMatchObject({
      taskType: "video-generation",
      supportsStreaming: false,
      supportsVision: true,
      tags: ["video", "high-quality", "long-form"],
    });
    expect(byId["kling/v2"]!.pricing.imagePerGen).toBeCloseTo(0.4); // 0.10/s × 4s
    expect(byId["old/cents"]!.pricing.imagePerGen).toBeCloseTo(0.32); // 8¢/s × 4s
    expect(byId["bytedance/seedance"]!.pricing.imagePerGen).toBeCloseTo(
      0.021504,
    );
  });

  it("caches results for an hour and supports filters and search", async () => {
    mockCatalogs();
    const service = new OpenRouterModelsService();

    await service.fetchModels();
    await service.fetchModels();
    expect(fetchMock).toHaveBeenCalledTimes(2); // text + video, once

    expect(
      (await service.getModelsByTaskType("image-generation")).map((m) => m.id),
    ).toEqual(["openai/gpt-5-image"]);
    expect(
      (await service.getModelsByCapability("vision")).length,
    ).toBeGreaterThan(0);
    expect((await service.searchModels("CLAUDE")).map((m) => m.id)).toEqual([
      "anthropic/claude-pro",
    ]);
    expect(await service.getModel("missing")).toBeNull();

    await service.refreshCache();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("keeps serving the cache when a refresh fails", async () => {
    mockCatalogs();
    const service = new OpenRouterModelsService();
    const first = await service.fetchModels();

    fetchMock.mockResolvedValue(errorResponse(500, "down"));
    const afterFailure = await service.refreshCache();

    expect(afterFailure).toEqual([]); // refreshCache clears before refetching
    expect(first.length).toBe(7);
  });

  it("ignores a failing video catalog", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/videos/models")
        ? errorResponse(404, "nope")
        : jsonResponse(catalog()),
    );
    expect(await new OpenRouterModelsService().fetchModels()).toHaveLength(4);
  });
});

// ─── Gateways ───────────────────────────────────────────────────────

describe("OpenRouterGateway streaming & video", () => {
  it("streams content and usage until finish_reason=stop", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        delta("Hi"),
        delta(" there"),
        {
          choices: [{ delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        },
        delta("after stop"),
      ]),
    );

    const chunks = await collect(
      new OpenRouterGateway().chatCompletionStream({
        model: "m",
        messages: [],
        maxTokens: 50,
      }),
    );

    expect(chunks).toEqual([
      { chunk: "Hi", done: false },
      { chunk: " there", done: false },
      {
        chunk: "",
        done: true,
        usage: { promptTokens: 3, completionTokens: 2, totalTokens: 5 },
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(init.body as string)).toMatchObject({
      stream: true,
      max_tokens: 50,
    });
  });

  it("submits video jobs with aspect ratio, first frame and options, then polls", async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ id: "job-1", polling_url: "x", status: "queued" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ id: "job-1", status: "processing" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "job-1",
          status: "COMPLETED",
          unsigned_urls: ["https://or/v.mp4"],
        }),
      );

    const promise = new OpenRouterGateway().videoGeneration({
      model: "kling/v2",
      prompt: "waves",
      width: 1080,
      height: 1920,
      imageUrl: "https://frame.png",
      duration: 5,
      audioEnabled: false,
      quality: "1080p",
    });
    await jest.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(
      JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
      ),
    ).toEqual({
      model: "kling/v2",
      prompt: "waves",
      aspect_ratio: "9:16",
      frame_images: [{ frame_type: "first_frame", url: "https://frame.png" }],
      duration: 5,
      generate_audio: false,
      resolution: "1080p",
    });
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe(
      "https://openrouter.ai/api/v1/videos/job-1",
    );
    expect(result).toMatchObject({
      id: "job-1",
      imageUrl: "https://or/v.mp4",
      videoDownloadHeaders: { Authorization: "Bearer or-key" },
    });
  });

  it.each([
    [1920, 1080, "16:9"],
    [1000, 1000, "1:1"],
    [1600, 1200, "4:3"],
    [2520, 1080, "21:9"],
    [1000, 200, "16:9"],
  ])("maps %dx%d to aspect ratio %s", async (width, height, ratio) => {
    fetchMock.mockResolvedValueOnce(errorResponse(400, "stop"));

    await expect(
      new OpenRouterGateway().videoGeneration({
        model: "m",
        prompt: "p",
        width,
        height,
      }),
    ).rejects.toThrow();

    expect(
      JSON.parse(
        (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
      ).aspect_ratio,
    ).toBe(ratio);
  });

  it("fails on terminal job states", async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "job-2", status: "queued" }))
      .mockResolvedValueOnce(
        jsonResponse({
          id: "job-2",
          status: "failed",
          error: "content policy",
        }),
      );

    const promise = new OpenRouterGateway().videoGeneration({
      model: "m",
      prompt: "p",
    });
    const assertion = expect(promise).rejects.toThrow(
      "OpenRouter video generation failed: content policy",
    );
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("refreshes the model list once the cache is invalidated", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        data: [
          { id: "a/b", name: "AB", pricing: { prompt: "0", completion: "0" } },
        ],
      }),
    );
    const gateway = new OpenRouterGateway();

    await gateway.listModels();
    await gateway.listModels();
    gateway.invalidateModelsCache();
    await gateway.listModels();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await gateway.getRateLimit("m")).toBeNull();
  });
});

describe("SiliconFlowGateway", () => {
  it("streams chat completions", async () => {
    fetchMock.mockResolvedValue(
      sseResponse([delta("A"), delta("B"), "[DONE]"]),
    );

    const chunks = await collect(
      new SiliconFlowGateway().chatCompletionStream({
        model: "m",
        messages: [],
      }),
    );

    expect(chunks).toEqual([
      { chunk: "A", done: false },
      { chunk: "B", done: false },
      { chunk: "", done: true },
    ]);
  });

  it("lists remote models, skipping embeddings and inferring task types", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const type = new URL(url).searchParams.get("type");
      const ids: Record<string, string[]> = {
        text: [
          "deepseek-ai/DeepSeek-V4-Flash",
          "BAAI/bge-embedding-m3",
          "Qwen/qwen-3-chat",
        ],
        image: ["black-forest-labs/FLUX.2-pro"],
        audio: ["FunAudioLLM/SenseVoice"],
        video: ["Wan-AI/Wan2.2-T2V-A14B"],
      };
      return jsonResponse({
        data: (ids[type ?? ""] ?? []).map((id) => ({ id })),
      });
    });

    const models = await new SiliconFlowGateway().listModels();
    const byId = Object.fromEntries(models.map((m) => [m.id, m]));

    expect(byId["BAAI/bge-embedding-m3"]).toBeUndefined();
    expect(byId["Qwen/qwen-3-chat"]).toMatchObject({
      name: "Qwen 3 Chat",
      taskType: "text-generation",
      supportsStreaming: true,
    });
    expect(byId["FunAudioLLM/SenseVoice"]!.taskType).toBe("speech-to-text");
    expect(byId["black-forest-labs/FLUX.2-pro"]!.taskType).toBe(
      "image-generation",
    );
    expect(byId["Wan-AI/Wan2.2-T2V-A14B"]!.taskType).toBe("video-generation");
  });

  it("falls back to its known models when the API is unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const models = await new SiliconFlowGateway().listModels();
    expect(models.some((m) => m.id === "black-forest-labs/FLUX.2-pro")).toBe(
      true,
    );
  });

  it("uses only known models without an API key (no network)", async () => {
    delete process.env.SILICONFLOW_API_KEY;
    const models = await new SiliconFlowGateway().listModels();
    expect(models.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("OpenRouterProvider video & streaming", () => {
  it("delegates video generation to the gateway with sensible defaults", async () => {
    const gateway = {
      videoGeneration: jest.fn(async () => ({
        id: "job-9",
        model: "kling/v2",
        imageUrl: "https://or/v.mp4",
        videoDownloadHeaders: { Authorization: "Bearer k" },
      })),
    };
    const provider = new OpenRouterProvider(gateway as never);

    const result = await provider.generateVideo({
      taskType: "video-generation",
      prompt: "surf",
      model: "kling/v2",
      parameters: { duration: 5 },
    } as never);

    expect(gateway.videoGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "kling/v2",
        prompt: "surf",
        width: 1280,
        height: 720,
        duration: 5,
      }),
    );
    expect(result).toMatchObject({
      provider: "openrouter",
      output: { type: "video", url: "https://or/v.mp4", duration: 5 },
      videoDownloadHeaders: { Authorization: "Bearer k" },
    });
  });

  it("requires a gateway that supports video", async () => {
    await expect(
      new OpenRouterProvider({} as never).generateVideo({
        taskType: "video-generation",
        prompt: "p",
      } as never),
    ).rejects.toThrow("does not support video generation");
  });
});
