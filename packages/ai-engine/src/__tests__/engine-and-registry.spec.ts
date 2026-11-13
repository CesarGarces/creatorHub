import type {
  AIRequest,
  AIResponse,
  AITaskType,
  AIProvider,
} from "@creator-hub/shared-types";
import type { AIProviderInterface } from "../providers/provider.interface";

const mockPrisma = { modelMetadata: { findFirst: jest.fn() } };
jest.mock("@creator-hub/database", () => ({ prisma: mockPrisma, Prisma: {} }));

import { AIEngineService } from "../ai-engine.service";
import { ProviderRegistry } from "../providers/provider-registry";
import { ProviderFactory } from "../providers/provider-factory";

function response(provider: string, content = "ok"): AIResponse {
  return {
    id: "r1",
    provider: provider as AIProvider,
    model: "m",
    output: { type: "text", content },
    usage: { credits: 1 },
    latency: 0,
  };
}

type FakeProvider = AIProviderInterface & {
  generate: jest.Mock;
  generateImage: jest.Mock;
  generateVideo?: jest.Mock;
};

function fakeProvider(
  name: string,
  tasks: AITaskType[],
  extra: Partial<FakeProvider> & { tier?: "free" | "pro" } = {},
): FakeProvider {
  return {
    name: name as AIProvider,
    supportedTasks: tasks,
    supportedModels: [],
    validateConfig: () => true,
    generate: jest.fn(async () => response(name)),
    generateImage: jest.fn(async () => response(name)),
    ...extra,
  } as FakeProvider;
}

function request(overrides: Partial<AIRequest> = {}): AIRequest {
  return {
    taskType: "text-generation",
    prompt: "hello",
    ...overrides,
  } as AIRequest;
}

beforeEach(() => {
  mockPrisma.modelMetadata.findFirst.mockReset().mockResolvedValue(null);
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe("AIEngineService.execute", () => {
  let registry: ProviderRegistry;
  let engine: AIEngineService;

  beforeEach(() => {
    registry = new ProviderRegistry();
    engine = new AIEngineService(registry);
  });

  it("uses an explicitly requested provider and reports latency", async () => {
    const a = fakeProvider("siliconflow", ["text-generation"]);
    const b = fakeProvider("openai", ["text-generation"]);
    registry.register(a);
    registry.register(b);

    const result = await engine.execute(request({ provider: "openai" }));

    expect(b.generate).toHaveBeenCalled();
    expect(a.generate).not.toHaveBeenCalled();
    expect(result.provider).toBe("openai");
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it("resolves a requested model to its provider via the model catalog", async () => {
    const openrouter = fakeProvider("openrouter", ["text-generation"]);
    registry.register(fakeProvider("siliconflow", ["text-generation"]));
    registry.register(openrouter);
    mockPrisma.modelMetadata.findFirst.mockResolvedValue({
      providerSlug: "openrouter",
    });

    await engine.execute(request({ model: "anthropic/claude" as never }));

    expect(mockPrisma.modelMetadata.findFirst).toHaveBeenCalledWith({
      where: { modelId: "anthropic/claude", isActive: true },
    });
    expect(openrouter.generate).toHaveBeenCalled();
  });

  it("falls back to any provider for the task when the model is unknown", async () => {
    const sf = fakeProvider("siliconflow", ["text-generation"]);
    registry.register(sf);

    await engine.execute(request({ model: "unknown/model" as never }));

    expect(sf.generate).toHaveBeenCalled();
  });

  it("fails with a configuration hint when no provider supports the task", async () => {
    await expect(
      engine.execute(request({ taskType: "video-generation" })),
    ).rejects.toThrow(/No AI providers available for task: video-generation/);
  });

  it("routes image requests to generateImage with 1024px defaults", async () => {
    const img = fakeProvider("flux", ["image-generation"]);
    registry.register(img);

    await engine.execute(
      request({
        taskType: "image-generation",
        prompt: "a cat",
        negativePrompt: "blurry",
        parameters: { aspectRatio: "16:9" },
      }),
    );

    expect(img.generateImage).toHaveBeenCalledWith({
      prompt: "a cat",
      negativePrompt: "blurry",
      width: 1024,
      height: 1024,
      aspectRatio: "16:9",
      model: undefined,
    });
    expect(img.generate).not.toHaveBeenCalled();
  });

  it("routes video requests to generateVideo when available", async () => {
    const video = fakeProvider("siliconflow-video", ["video-generation"], {
      generateVideo: jest.fn(async () => response("siliconflow-video")),
    });
    registry.register(video);

    await engine.execute(request({ taskType: "video-generation" }));

    expect(video.generateVideo).toHaveBeenCalled();
    expect(video.generate).not.toHaveBeenCalled();
  });

  it.each([
    "billing limit reached",
    "rate limit exceeded",
    "quota exhausted",
    "model not found (404)",
  ])(
    "fails over to the next provider on retryable error %j",
    async (message) => {
      const first = fakeProvider("siliconflow", ["text-generation"]);
      const second = fakeProvider("openai", ["text-generation"]);
      first.generate.mockRejectedValue(new Error(message));
      registry.register(first);
      registry.register(second);

      const result = await engine.execute(request());

      expect(second.generate).toHaveBeenCalled();
      expect(result.provider).toBe("openai");
    },
  );

  it("does not fail over on non-retryable errors", async () => {
    const first = fakeProvider("siliconflow", ["text-generation"]);
    const second = fakeProvider("openai", ["text-generation"]);
    first.generate.mockRejectedValue(new Error("invalid prompt"));
    registry.register(first);
    registry.register(second);

    await expect(engine.execute(request())).rejects.toThrow("invalid prompt");
    expect(second.generate).not.toHaveBeenCalled();
  });

  it("rethrows the last error when every provider fails", async () => {
    const first = fakeProvider("siliconflow", ["text-generation"]);
    const second = fakeProvider("openai", ["text-generation"]);
    first.generate.mockRejectedValue(new Error("rate limit"));
    second.generate.mockRejectedValue(new Error("quota exceeded"));
    registry.register(first);
    registry.register(second);

    await expect(engine.execute(request())).rejects.toThrow("quota exceeded");
  });

  it("generateImage builds an image request with sizing options", async () => {
    const img = fakeProvider("flux", ["image-generation"]);
    registry.register(img);

    await engine.generateImage("a dog", {
      width: 512,
      height: 768,
      userId: "u1",
      toolId: "thumb",
    });

    expect(img.generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "a dog", width: 512, height: 768 }),
    );
  });
});

describe("ProviderRegistry", () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it("registers, looks up and unregisters providers", () => {
    registry.register(fakeProvider("flux", ["image-generation"]));

    expect(registry.isRegistered("flux")).toBe(true);
    expect(registry.getProvider("flux").name).toBe("flux");
    registry.unregister("flux");
    expect(() => registry.getProvider("flux")).toThrow(
      "AI provider not registered: flux",
    );
  });

  it("orders task providers by how primary the task is for them", () => {
    registry.register(
      fakeProvider("openai", ["image-generation", "text-generation"]),
    );
    registry.register(
      fakeProvider("siliconflow", ["text-generation", "image-generation"]),
    );

    expect(
      registry.getProvidersByTask("text-generation").map((p) => p.name),
    ).toEqual(["siliconflow", "openai"]);
    expect(registry.getAnyProviderForTask("image-generation")?.name).toBe(
      "openai",
    );
    expect(registry.getAnyProviderForTask("speech-to-text")).toBeUndefined();
  });

  it("splits providers into free and pro tiers (untiered counts as pro)", () => {
    registry.register(
      fakeProvider("siliconflow", ["text-generation"], { tier: "free" }),
    );
    registry.register(
      fakeProvider("openai", ["text-generation"], { tier: "pro" }),
    );
    registry.register(fakeProvider("flux", ["image-generation"]));

    expect(registry.getFreeProviders().map((p) => p.name)).toEqual([
      "siliconflow",
    ]);
    expect(registry.getProProviders().map((p) => p.name)).toEqual([
      "openai",
      "flux",
    ]);
  });

  describe("getProviderForUser", () => {
    beforeEach(() => {
      registry.register(
        fakeProvider("siliconflow", ["text-generation"], { tier: "free" }),
      );
      registry.register(
        fakeProvider("openai", ["text-generation"], { tier: "pro" }),
      );
    });

    it.each([
      [{ plan: "FREE", currentCredits: 10 }, "siliconflow"],
      [{ plan: "PRO", currentCredits: 0 }, "openai"],
      [{ plan: "STARTER", currentCredits: 0 }, "openai"],
    ])("routes %o to %s", (user, expected) => {
      expect(registry.getProviderForUser(user).name).toBe(expected);
    });

    it("refuses FREE users without credits", () => {
      expect(() =>
        registry.getProviderForUser({ plan: "FREE", currentCredits: 0 }),
      ).toThrow(/No credits available/);
    });
  });

  describe("model resolution", () => {
    it("prefers the catalog mapping, then hardcoded supported models", async () => {
      const legacy = fakeProvider("flux", ["image-generation"], {
        supportedModels: ["flux-dev"],
      });
      registry.register(legacy);
      registry.register(fakeProvider("openrouter", ["image-generation"]));

      mockPrisma.modelMetadata.findFirst.mockResolvedValueOnce({
        providerSlug: "openrouter",
      });
      expect((await registry.getProviderForModel("flux-dev"))?.name).toBe(
        "openrouter",
      );

      mockPrisma.modelMetadata.findFirst.mockResolvedValueOnce(null);
      expect((await registry.getProviderForModel("flux-dev"))?.name).toBe(
        "flux",
      );

      mockPrisma.modelMetadata.findFirst.mockResolvedValueOnce({
        providerSlug: "not-registered",
      });
      expect(await registry.getProviderForModel("nope")).toBeUndefined();
    });

    it("only returns streaming-capable providers for streaming lookups", async () => {
      const streaming = fakeProvider("siliconflow", ["text-generation"], {
        supportedModels: ["deepseek"],
        generateStream: jest.fn() as never,
      });
      const nonStreaming = fakeProvider("openai", ["text-generation"], {
        supportedModels: ["gpt"],
      });
      registry.register(streaming);
      registry.register(nonStreaming);

      mockPrisma.modelMetadata.findFirst.mockResolvedValueOnce({
        providerSlug: "openai",
      });
      expect(
        await registry.getStreamingProviderForModel("gpt"),
      ).toBeUndefined();

      expect(mockPrisma.modelMetadata.findFirst.mock.calls[0][0].where).toEqual(
        {
          modelId: "gpt",
          isActive: true,
          supportsStreaming: true,
        },
      );
      expect(
        (await registry.getStreamingProviderForModel("deepseek"))?.name,
      ).toBe("siliconflow");
      expect(registry.getStreamingProviders().map((p) => p.name)).toEqual([
        "siliconflow",
      ]);
    });
  });
});

describe("ProviderFactory", () => {
  const KEYS = [
    "OPENAI_API_KEY",
    "STABILITY_AI_API_KEY",
    "FLUX_API_KEY",
    "SILICONFLOW_API_KEY",
    "NODE_ENV",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  function build(openRouterGateway?: object) {
    const registry = new ProviderRegistry();
    const gatewayFactory = {
      getGatewayByType: jest.fn(() => openRouterGateway),
    };
    new ProviderFactory(registry, gatewayFactory as never).onModuleInit();
    return registry.getAllProviders().map((p) => p.name);
  }

  it("registers only providers whose API keys are configured", () => {
    process.env.NODE_ENV = "production";
    process.env.SILICONFLOW_API_KEY = "sk";
    process.env.FLUX_API_KEY = "fk";

    expect(build()).toEqual(["flux", "siliconflow", "siliconflow-video"]);
  });

  it("adds the mock image provider in development without SiliconFlow", () => {
    process.env.NODE_ENV = "development";
    expect(build()).toEqual(["mock"]);
  });

  it("never registers the mock provider in production", () => {
    process.env.NODE_ENV = "production";
    expect(build()).toEqual([]);
  });

  it("registers OpenRouter when its gateway is available", () => {
    process.env.NODE_ENV = "production";
    expect(build({ name: "openrouter-gateway" })).toEqual(["openrouter"]);
  });
});
