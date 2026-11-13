import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { ContentSampleService } from "../services/content-sample.service";
import { StyleAnalyzerService } from "../services/style-analyzer.service";
import { StyleInjectionService } from "../services/style-injection.service";
import { StyleProfileService } from "../services/style-profile.service";
import { UserStyleController } from "../user-style.controller";

beforeEach(() => {
  resetPrismaMock();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("ContentSampleService", () => {
  const service = new ContentSampleService();

  it("rejects samples shorter than 10 characters after trimming", async () => {
    await expect(
      service.create("u1", { content: "   short   " }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.userContentSample.create).not.toHaveBeenCalled();
  });

  it("stores a trimmed sample with MANUAL as the default source", async () => {
    await service.create("u1", { content: "  This is my writing style  " });

    expect(prismaMock.userContentSample.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        content: "This is my writing style",
        source: "MANUAL",
      },
    });
  });

  it("bulk-creates only the valid samples", async () => {
    prismaMock.userContentSample.createMany.mockResolvedValue({ count: 2 });

    const result = await service.createBulk("u1", [
      { content: "A long enough tweet", source: "TWEET" },
      { content: "tiny" },
      { content: "  Another valid post  " },
    ]);

    expect(result).toEqual({ count: 2 });
    expect(prismaMock.userContentSample.createMany).toHaveBeenCalledWith({
      data: [
        { userId: "u1", content: "A long enough tweet", source: "TWEET" },
        { userId: "u1", content: "Another valid post", source: "MANUAL" },
      ],
    });
  });

  it("rejects a bulk request where every sample is too short", async () => {
    await expect(service.createBulk("u1", [{ content: "no" }])).rejects.toThrow(
      BadRequestException,
    );
    expect(prismaMock.userContentSample.createMany).not.toHaveBeenCalled();
  });

  it("lists active samples with pagination", async () => {
    prismaMock.userContentSample.findMany.mockResolvedValue([]);
    prismaMock.userContentSample.count.mockResolvedValue(21);

    const result = await service.list("u1", 2, 10);

    expect(
      prismaMock.userContentSample.findMany.mock.calls[0]![0],
    ).toMatchObject({
      where: { userId: "u1", isActive: true },
      skip: 10,
      take: 10,
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 21,
      totalPages: 3,
    });
  });

  it("only deletes the user's own samples", async () => {
    prismaMock.userContentSample.findFirst.mockResolvedValue(null);

    await expect(service.delete("u1", "sample-of-u2")).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.userContentSample.findFirst).toHaveBeenCalledWith({
      where: { id: "sample-of-u2", userId: "u1" },
    });
    expect(prismaMock.userContentSample.delete).not.toHaveBeenCalled();
  });
});

describe("StyleProfileService", () => {
  const service = new StyleProfileService();

  it("update and delete require an existing profile", async () => {
    prismaMock.userStyleProfile.findUnique.mockResolvedValue(null);

    await expect(service.update("u1", { tone: "calm" })).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.delete("u1")).rejects.toThrow(NotFoundException);
    expect(prismaMock.userStyleProfile.update).not.toHaveBeenCalled();
    expect(prismaMock.userStyleProfile.delete).not.toHaveBeenCalled();
  });

  it("upserts the analysis result with a timestamp", async () => {
    await service.upsert("u1", {
      tone: "direct",
      vocabKeywords: ["growth"],
      language: "en",
      sentenceLength: "short",
      emojiUsage: "low",
      formalityLevel: "casual",
      summary: "Short and punchy",
      sampleCount: 5,
    });

    const args = prismaMock.userStyleProfile.upsert.mock.calls[0]![0];
    expect(args.where).toEqual({ userId: "u1" });
    expect(args.create).toMatchObject({
      userId: "u1",
      tone: "direct",
      sampleCount: 5,
    });
    expect(args.update.lastAnalyzedAt).toBeInstanceOf(Date);
  });
});

describe("StyleAnalyzerService", () => {
  const aiEngine = { execute: vi.fn() };
  const creditService = { hasEnoughCredits: vi.fn(), deduct: vi.fn() };
  const sampleService = { getRecentSamples: vi.fn() };
  const profileService = { upsert: vi.fn() };
  const service = new StyleAnalyzerService(
    aiEngine as never,
    creditService as never,
    sampleService as never,
    profileService as never,
  );
  const samples = [
    { content: "Sample one text" },
    { content: "Sample two text" },
    { content: "Sample three text" },
  ];
  const aiReturns = (content: string) =>
    aiEngine.execute.mockResolvedValue({ output: { type: "text", content } });

  beforeEach(() => {
    vi.clearAllMocks();
    sampleService.getRecentSamples.mockResolvedValue(samples);
    creditService.hasEnoughCredits.mockResolvedValue(true);
  });

  it("requires at least 3 samples and does not charge", async () => {
    sampleService.getRecentSamples.mockResolvedValue(samples.slice(0, 2));

    await expect(service.analyze("u1")).rejects.toThrow(BadRequestException);
    expect(creditService.hasEnoughCredits).not.toHaveBeenCalled();
    expect(aiEngine.execute).not.toHaveBeenCalled();
  });

  it("requires 1 credit before calling the AI", async () => {
    creditService.hasEnoughCredits.mockResolvedValue(false);

    await expect(service.analyze("u1")).rejects.toThrow(/requires 1 credit/);
    expect(creditService.hasEnoughCredits).toHaveBeenCalledWith("u1", 1);
    expect(aiEngine.execute).not.toHaveBeenCalled();
  });

  it("parses a fenced JSON reply, saves the profile and charges 1 credit", async () => {
    aiReturns(
      '```json\n{"tone":"witty","vocabKeywords":["ai","growth"],"language":"EN-us",' +
        '"sentenceLength":"short","emojiUsage":"high","formalityLevel":"casual","summary":"Fun"}\n```',
    );

    const result = await service.analyze("u1");

    expect(result).toEqual({
      tone: "witty",
      vocabKeywords: ["ai", "growth"],
      language: "en",
      sentenceLength: "short",
      emojiUsage: "high",
      formalityLevel: "casual",
      summary: "Fun",
    });
    expect(sampleService.getRecentSamples).toHaveBeenCalledWith("u1", 10);
    const request = aiEngine.execute.mock.calls[0]![0];
    expect(request).toMatchObject({ taskType: "text-analysis", userId: "u1" });
    expect(request.prompt).toContain('Muestra 3: "Sample three text"');
    expect(profileService.upsert).toHaveBeenCalledWith("u1", {
      ...result,
      sampleCount: 3,
    });
    expect(creditService.deduct).toHaveBeenCalledWith(
      "u1",
      1,
      "user-style",
      "Style analysis",
    );
  });

  it("replaces invalid enum values with safe defaults and caps keywords at 10", async () => {
    aiReturns(
      JSON.stringify({
        tone: "calm",
        vocabKeywords: Array.from({ length: 15 }, (_, i) => `k${i}`),
        sentenceLength: "enormous",
        emojiUsage: "always",
        formalityLevel: "royal",
      }),
    );

    const result = await service.analyze("u1");

    expect(result).toMatchObject({
      language: "es",
      sentenceLength: "medium",
      emojiUsage: "moderate",
      formalityLevel: "casual",
      summary: "",
    });
    expect(result.vocabKeywords).toHaveLength(10);
  });

  it.each([
    ["not json at all"],
    [JSON.stringify({ vocabKeywords: [] })],
    [JSON.stringify({ tone: "ok", vocabKeywords: "not-an-array" })],
  ])(
    "rejects an unusable AI reply without saving or charging: %s",
    async (reply) => {
      aiReturns(reply);

      await expect(service.analyze("u1")).rejects.toThrow(
        "Failed to parse style analysis. Please try again.",
      );
      expect(profileService.upsert).not.toHaveBeenCalled();
      expect(creditService.deduct).not.toHaveBeenCalled();
    },
  );
});

describe("StyleInjectionService", () => {
  const profileService = { getByUserId: vi.fn() };
  const service = new StyleInjectionService(profileService as never);
  const profile = {
    isActive: true,
    language: "pt",
    tone: "friendly",
    vocabKeywords: ["creator", "growth"],
    sentenceLength: "short",
    emojiUsage: "low",
    formalityLevel: "casual",
    summary: "Warm and brief",
  };

  it("returns nothing when there is no active profile", async () => {
    profileService.getByUserId.mockResolvedValueOnce(null);
    expect(await service.getStylePrompt("u1")).toBe("");

    profileService.getByUserId.mockResolvedValueOnce({
      ...profile,
      isActive: false,
    });
    expect(await service.getStylePrompt("u1")).toBe("");
  });

  it("formats the profile into a style prompt", async () => {
    profileService.getByUserId.mockResolvedValue(profile);

    const prompt = await service.getStylePrompt("u1");

    expect(prompt).toContain("Primary Language: Portuguese (pt)");
    expect(prompt).toContain("Keywords: creator, growth");
    expect(prompt).toContain("- Style summary: Warm and brief");
  });

  it("handles unknown languages, no keywords and no summary", async () => {
    profileService.getByUserId.mockResolvedValue({
      ...profile,
      language: "nl",
      vocabKeywords: [],
      summary: null,
    });

    const prompt = await service.getStylePrompt("u1");

    expect(prompt).toContain("Primary Language: NL (nl)");
    expect(prompt).toContain("Keywords: none specified");
    expect(prompt).not.toContain("Style summary");
  });
});

describe("UserStyleController", () => {
  const profileService = {
    getByUserId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const analyzerService = { analyze: vi.fn() };
  const sampleService = {
    create: vi.fn(),
    createBulk: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
  };
  const controller = new UserStyleController(
    profileService as never,
    analyzerService as never,
    sampleService as never,
  );

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, UserStyleController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it("wraps results in a success envelope scoped to the current user", async () => {
    profileService.getByUserId.mockResolvedValue({ tone: "calm" });
    sampleService.createBulk.mockResolvedValue({ count: 3 });
    sampleService.list.mockResolvedValue({ data: [], meta: { page: 1 } });

    expect(await controller.getProfile("u1")).toEqual({
      success: true,
      data: { tone: "calm" },
    });
    expect(await controller.deleteProfile("u1")).toEqual({
      success: true,
      data: null,
    });
    expect(
      await controller.addBulkSamples("u1", {
        samples: [{ content: "x".repeat(20) }],
      }),
    ).toEqual({ success: true, data: { count: 3 } });
    expect(await controller.listSamples("u1", 1, 20)).toEqual({
      success: true,
      data: [],
      meta: { page: 1 },
    });
    expect(await controller.deleteSample("u1", "s1")).toEqual({
      success: true,
      data: null,
    });

    expect(profileService.delete).toHaveBeenCalledWith("u1");
    expect(sampleService.list).toHaveBeenCalledWith("u1", 1, 20);
    expect(sampleService.delete).toHaveBeenCalledWith("u1", "s1");
  });

  it("runs style analysis for the current user", async () => {
    analyzerService.analyze.mockResolvedValue({ tone: "bold" });

    expect(await controller.analyze("u1")).toEqual({
      success: true,
      data: { tone: "bold" },
    });
    expect(analyzerService.analyze).toHaveBeenCalledWith("u1");
  });
});
