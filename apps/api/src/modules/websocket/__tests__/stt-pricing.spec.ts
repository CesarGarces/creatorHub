import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { __resetSttPricingCache, getSttCreditsPerMinute } from "../stt-pricing";

beforeEach(() => {
  resetPrismaMock();
  __resetSttPricingCache();
});

describe("getSttCreditsPerMinute", () => {
  it("uses the active speech-to-text model's credit cost from Admin → AI Models", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue({ creditCost: 3 });

    expect(await getSttCreditsPerMinute(0)).toBe(3);
    expect(prismaMock.modelMetadata.findFirst).toHaveBeenCalledWith({
      where: { taskType: "speech-to-text", isActive: true },
      orderBy: { updatedAt: "desc" },
      select: { creditCost: true },
    });
  });

  it("defaults to 1 credit per minute when none is configured or the lookup fails", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue(null);
    expect(await getSttCreditsPerMinute(0)).toBe(1);

    __resetSttPricingCache();
    prismaMock.modelMetadata.findFirst.mockRejectedValue(new Error("db down"));
    expect(await getSttCreditsPerMinute(0)).toBe(1);
  });

  it("caches the price for a minute", async () => {
    prismaMock.modelMetadata.findFirst.mockResolvedValue({ creditCost: 2 });
    await getSttCreditsPerMinute(0);
    prismaMock.modelMetadata.findFirst.mockResolvedValue({ creditCost: 5 });

    expect(await getSttCreditsPerMinute(59_000)).toBe(2);
    expect(await getSttCreditsPerMinute(61_000)).toBe(5);
    expect(prismaMock.modelMetadata.findFirst).toHaveBeenCalledTimes(2);
  });
});
