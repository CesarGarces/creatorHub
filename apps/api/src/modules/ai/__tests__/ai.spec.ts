import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { AIService } from "../ai.service";
import { AIController } from "../ai.controller";

describe("AIService", () => {
  const service = new AIService();

  beforeEach(() => resetPrismaMock());

  describe("getActiveProviders", () => {
    it("only queries active providers and maps them to the public shape", async () => {
      prismaMock.provider.findMany.mockResolvedValue([
        {
          slug: "flux-pro",
          name: "Flux Pro",
          tier: "PRO",
          costPerCredit: 5,
          model: "bfl/flux-pro",
          supportedTasks: ["image-generation"],
          modes: [
            { mode: { slug: "image", isActive: true } },
            { mode: { slug: "legacy", isActive: false } },
          ],
        },
        {
          slug: "sd",
          name: "Stable Diffusion",
          tier: "FREE",
          costPerCredit: 1,
          model: "sd-xl",
          supportedTasks: [],
          modes: [],
        },
      ]);

      const result = await service.getActiveProviders();

      expect(prismaMock.provider.findMany.mock.calls[0]![0].where).toEqual({
        isActive: true,
      });
      expect(result).toEqual([
        {
          id: "flux-pro",
          name: "Flux Pro",
          displayName: "Flux Pro",
          tier: "pro",
          costPerCredit: 5,
          model: "bfl/flux-pro",
          supportedTasks: ["image-generation"],
          modes: ["image"],
        },
        expect.objectContaining({ id: "sd", tier: "free", modes: [] }),
      ]);
    });
  });

  describe("getActiveModels", () => {
    beforeEach(() => prismaMock.modelMetadata.findMany.mockResolvedValue([]));

    it("returns all active models when no task types are given", async () => {
      await service.getActiveModels();

      expect(prismaMock.modelMetadata.findMany.mock.calls[0]![0].where).toEqual(
        { isActive: true },
      );
    });

    it("parses, trims and drops empty task types", async () => {
      await service.getActiveModels(" image-generation, ,text-generation ,");

      expect(prismaMock.modelMetadata.findMany.mock.calls[0]![0].where).toEqual(
        {
          isActive: true,
          taskType: { in: ["image-generation", "text-generation"] },
        },
      );
    });

    it("treats a string of only commas as 'no filter'", async () => {
      await service.getActiveModels(",,");

      expect(prismaMock.modelMetadata.findMany.mock.calls[0]![0].where).toEqual(
        { isActive: true },
      );
    });

    it("maps tiers to lowercase pro/free", async () => {
      prismaMock.modelMetadata.findMany.mockResolvedValue([
        {
          id: "m1",
          providerSlug: "openrouter",
          modelId: "anthropic/claude",
          displayName: "Claude",
          taskType: "text-generation",
          tier: "PRO",
          creditCost: 3,
          isActive: true,
          supportsStreaming: true,
          supportsVision: false,
          description: null,
          tags: ["chat"],
          profitMargin: 0.4,
        },
      ]);

      const [model] = await service.getActiveModels();

      expect(model).toEqual({
        id: "m1",
        providerSlug: "openrouter",
        modelId: "anthropic/claude",
        displayName: "Claude",
        taskType: "text-generation",
        tier: "pro",
        creditCost: 3,
        isActive: true,
        supportsStreaming: true,
        supportsVision: false,
        description: null,
        tags: ["chat"],
      });
      // Internal pricing data must not leak to the client.
      expect(model).not.toHaveProperty("profitMargin");
    });
  });
});

describe("AIController", () => {
  it("requires authentication", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AIController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it("delegates to AIService", async () => {
    const aiService = {
      getActiveProviders: vi.fn().mockResolvedValue(["p"]),
      getActiveModels: vi.fn().mockResolvedValue(["m"]),
    };
    const controller = new AIController(aiService as never);

    expect(await controller.getProviders()).toEqual(["p"]);
    expect(await controller.getModels("image-generation")).toEqual(["m"]);
    expect(aiService.getActiveModels).toHaveBeenCalledWith("image-generation");
  });
});
