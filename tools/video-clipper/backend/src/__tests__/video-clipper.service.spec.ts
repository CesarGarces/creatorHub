import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

vi.mock("@creator-hub/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: (await import("./helpers/prisma-mock")).prismaMock,
}));

import { prismaMock, resetPrismaMock } from "./helpers/prisma-mock";
import {
  AnalysisAbortedError,
  VideoClipperService,
  type AnalyzeVideoInput,
} from "../video-clipper.service";

const FRAME = "data:image/jpeg;base64,AAAA";

const modelReply = {
  summary: "Cooking vlog",
  contentType: "vlog",
  highlights: [
    {
      start: 20,
      end: 45,
      title: "Sauce",
      hook: "Watch this",
      reason: "Payoff",
      score: 88,
    },
  ],
  hooks: ["Stop doing this"],
  titles: ["30 days of pasta"],
  hashtags: ["#pasta"],
};

const VISION_MODEL = {
  modelId: "google/gemini-2.5-flash",
  displayName: "Gemini 2.5 Flash",
  creditCost: 4,
  tier: "FREE" as const,
};

function frames(count: number, step = 5) {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: (count - i) * step, // unsorted on purpose
    image: FRAME,
  }));
}

function setup(options: { reply?: string; supportsImageInput?: boolean } = {}) {
  const provider = {
    supportsImageInput: options.supportsImageInput ?? true,
    generate: vi.fn(async () => ({
      output: {
        type: "text",
        content: options.reply ?? JSON.stringify(modelReply),
      },
    })),
  };
  const providers = { getProviderForModel: vi.fn(async () => provider) };
  const credits = {
    hasEnoughCredits: vi.fn(async () => true),
    deduct: vi.fn(async () => true),
  };
  const usage = { logUsage: vi.fn(async () => undefined) };
  const service = new VideoClipperService(
    providers as never,
    credits as never,
    usage as never,
  );

  prismaMock.modelMetadata.findFirst.mockResolvedValue(VISION_MODEL);
  prismaMock.user.findUnique.mockResolvedValue({ plan: "FREE" });
  prismaMock.videoAnalysis.create.mockImplementation(async ({ data }) => ({
    id: "va1",
    ...data,
  }));
  prismaMock.videoAnalysis.delete.mockResolvedValue({});

  return { service, provider, providers, credits, usage };
}

function input(overrides: Partial<AnalyzeVideoInput> = {}): AnalyzeVideoInput {
  return {
    userId: "u1",
    modelId: VISION_MODEL.modelId,
    video: {
      fileName: "vlog.mp4",
      durationSec: 120,
      width: 1920,
      height: 1080,
      sizeBytes: 80_000_000,
    },
    frames: frames(10),
    platform: "youtube-shorts",
    language: "en",
    ...overrides,
  };
}

beforeEach(() => resetPrismaMock());

describe("VideoClipperService.estimate", () => {
  it("prices the model's credit cost per batch of 12 keyframes", async () => {
    const { service } = setup();
    await expect(
      service.estimate("u1", VISION_MODEL.modelId, 20),
    ).resolves.toEqual({
      modelId: VISION_MODEL.modelId,
      modelName: "Gemini 2.5 Flash",
      modelCost: 4,
      frames: 20,
      units: 2,
      total: 8,
    });
    // Only active text models flagged as vision-capable qualify.
    expect(prismaMock.modelMetadata.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          modelId: VISION_MODEL.modelId,
          isActive: true,
          taskType: "text-generation",
          supportsVision: true,
        },
      }),
    );
  });
});

describe("VideoClipperService.analyze", () => {
  it("sends sorted keyframes to the vision model, saves the JSON, then charges", async () => {
    const { service, provider, credits, usage } = setup();

    const out = await service.analyze(
      input({ context: "Pasta", language: "es" }),
    );

    // Request: multimodal, system prompt with the JSON contract, frames in time order.
    const request = provider.generate.mock.calls[0]![0] as never as {
      model: string;
      images: { caption: string }[];
      parameters: { systemPrompt: string };
      toolId: string;
    };
    expect(request.model).toBe(VISION_MODEL.modelId);
    expect(request.toolId).toBe("video-clipper");
    expect(request.images).toHaveLength(10);
    expect(request.images[0]!.caption).toContain("t=5s");
    expect(request.images[9]!.caption).toContain("t=50s");
    expect(request.parameters.systemPrompt).toContain("Spanish");

    // Result: normalised analysis + metadata.
    expect(out.analysisId).toBe("va1");
    expect(out.creditsCharged).toBe(4);
    expect(out.result).toMatchObject({
      highlights: [{ id: "h1", start: 20, end: 45, title: "Sauce", score: 88 }],
      hooks: [{ text: "Stop doing this", style: null }],
      titles: [{ text: "30 days of pasta", platform: null }],
      platform: "youtube-shorts",
      language: "es",
      frames: 10,
      video: {
        fileName: "vlog.mp4",
        durationSec: 120,
        width: 1920,
        height: 1080,
      },
      model: { id: VISION_MODEL.modelId, name: "Gemini 2.5 Flash" },
    });

    // Only JSON is stored — never the frames or the video.
    const saved = prismaMock.videoAnalysis.create.mock.calls[0]![0].data;
    expect(saved).toMatchObject({
      userId: "u1",
      frameCount: 10,
      creditsCharged: 4,
    });
    expect(JSON.stringify(saved)).not.toContain(FRAME);

    // Save → charge order.
    expect(
      prismaMock.videoAnalysis.create.mock.invocationCallOrder[0],
    ).toBeLessThan(credits.deduct.mock.invocationCallOrder[0]!);
    expect(credits.deduct).toHaveBeenCalledWith(
      "u1",
      4,
      "video-clipper",
      "Video analysis: vlog.mp4",
    );
    expect(usage.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        credits: 4,
        toolId: "video-clipper",
      }),
    );
  });

  it("charges more units for more keyframes", async () => {
    const { service, credits } = setup();
    const out = await service.analyze(input({ frames: frames(30, 3) }));
    expect(out.creditsCharged).toBe(12); // 4 credits × 3 units
    expect(credits.hasEnoughCredits).toHaveBeenCalledWith("u1", 12);
  });

  it("does not charge a 0-credit model", async () => {
    const { service, credits } = setup();
    prismaMock.modelMetadata.findFirst.mockResolvedValue({
      ...VISION_MODEL,
      creditCost: 0,
    });
    const out = await service.analyze(input());
    expect(out.creditsCharged).toBe(0);
    expect(credits.deduct).not.toHaveBeenCalled();
  });

  it("refuses models that are not vision-capable", async () => {
    const { service, provider } = setup();
    prismaMock.modelMetadata.findFirst.mockResolvedValue(null);
    await expect(service.analyze(input())).rejects.toThrow(
      "This model can't analyze video frames. Choose a vision model.",
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("refuses providers that can't receive images", async () => {
    const { service, provider } = setup({ supportsImageInput: false });
    await expect(service.analyze(input())).rejects.toThrow(
      "Selected provider is not available",
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("refuses PRO models on the FREE plan and allows them on paid plans", async () => {
    const { service } = setup();
    prismaMock.modelMetadata.findFirst.mockResolvedValue({
      ...VISION_MODEL,
      tier: "PRO",
    });
    await expect(service.analyze(input())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prismaMock.user.findUnique.mockResolvedValue({ plan: "STARTER" });
    await expect(service.analyze(input())).resolves.toMatchObject({
      analysisId: "va1",
    });
  });

  it("stops before calling the model when credits are insufficient", async () => {
    const { service, provider, credits } = setup();
    credits.hasEnoughCredits.mockResolvedValue(false);
    await expect(service.analyze(input())).rejects.toThrow(
      "Insufficient credits. This analysis requires 4 credits.",
    );
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("rejects keyframes outside the video", async () => {
    const { service } = setup();
    await expect(
      service.analyze(input({ frames: [{ timestamp: 500, image: FRAME }] })),
    ).rejects.toThrow("Keyframe timestamps must be within the video duration");
  });

  it("does not save or charge when the model reply is invalid", async () => {
    const { service, credits, usage } = setup({
      reply: "Sorry, I can't watch videos.",
    });
    await expect(service.analyze(input())).rejects.toThrow(
      "The model didn't return a valid analysis. Try again or choose another model.",
    );
    expect(prismaMock.videoAnalysis.create).not.toHaveBeenCalled();
    expect(credits.deduct).not.toHaveBeenCalled();
    expect(usage.logUsage).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, credits: 0 }),
    );
  });

  it("maps model/provider failures to 502 without charging", async () => {
    const { service, provider, credits } = setup();
    provider.generate.mockRejectedValue(
      new Error("OpenRouter API error 400: image too large"),
    );
    await expect(service.analyze(input())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(credits.deduct).not.toHaveBeenCalled();
  });

  it("does not save or charge when the client disconnected during the analysis", async () => {
    const { service, provider, credits } = setup();
    const abort = new AbortController();
    provider.generate.mockImplementation(async () => {
      abort.abort();
      return { output: { type: "text", content: JSON.stringify(modelReply) } };
    });
    await expect(
      service.analyze(input({ signal: abort.signal })),
    ).rejects.toBeInstanceOf(AnalysisAbortedError);
    expect(prismaMock.videoAnalysis.create).not.toHaveBeenCalled();
    expect(credits.deduct).not.toHaveBeenCalled();
  });

  it("removes the saved analysis when the charge fails (race with another debit)", async () => {
    const { service, credits } = setup();
    credits.deduct.mockResolvedValue(false);
    await expect(service.analyze(input())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prismaMock.videoAnalysis.delete).toHaveBeenCalledWith({
      where: { id: "va1" },
    });
  });
});

describe("VideoClipperService history", () => {
  it("lists the user's analyses with a summary", async () => {
    const { service } = setup();
    const createdAt = new Date("2026-11-20T10:00:00Z");
    prismaMock.videoAnalysis.findMany.mockResolvedValue([
      {
        id: "va1",
        fileName: "vlog.mp4",
        durationSec: 120,
        frameCount: 10,
        modelId: VISION_MODEL.modelId,
        creditsCharged: 4,
        createdAt,
        result: { highlights: [{}, {}], titles: [{ text: "Best title" }] },
      },
    ]);
    prismaMock.videoAnalysis.count.mockResolvedValue(21);

    const page = await service.listAnalyses("u1", 2, 10);

    expect(prismaMock.videoAnalysis.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      orderBy: { createdAt: "desc" },
      skip: 10,
      take: 10,
    });
    expect(page).toEqual({
      data: [
        {
          id: "va1",
          fileName: "vlog.mp4",
          durationSec: 120,
          frameCount: 10,
          modelId: VISION_MODEL.modelId,
          creditsCharged: 4,
          highlights: 2,
          topTitle: "Best title",
          createdAt,
        },
      ],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });

  it("only returns and deletes the user's own analyses", async () => {
    const { service } = setup();
    prismaMock.videoAnalysis.findFirst.mockResolvedValue(null);
    await expect(service.getAnalysis("u1", "other")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prismaMock.videoAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "other", userId: "u1" },
    });

    prismaMock.videoAnalysis.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteAnalysis("u1", "other")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prismaMock.videoAnalysis.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.deleteAnalysis("u1", "va1")).resolves.toBeUndefined();
    expect(prismaMock.videoAnalysis.deleteMany).toHaveBeenLastCalledWith({
      where: { id: "va1", userId: "u1" },
    });
  });
});
