import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("./prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { prismaMock, resetPrismaMock } from "./prisma-mock";
import { AnalyticsService } from "../analytics.service";
import { UsageTracker } from "../usage.tracker";
import { PlatformUsageLogger } from "../platform-usage-logger";

beforeEach(() => {
  resetPrismaMock();
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AnalyticsService", () => {
  const service = new AnalyticsService();

  it("groups a tool's usage over the last N days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T12:00:00Z"));
    prismaMock.usageLog.groupBy.mockResolvedValue([]);

    await service.getToolUsage("thumb", 7);

    const args = prismaMock.usageLog.groupBy.mock.calls[0]![0];
    expect(args.where.toolId).toBe("thumb");
    expect(args.where.createdAt.gte.toISOString()).toBe(
      "2026-03-24T12:00:00.000Z",
    );
    expect(args._sum).toEqual({ credits: true });
  });

  it("defaults to a 30-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T12:00:00Z"));
    prismaMock.usageLog.groupBy.mockResolvedValue([]);

    await service.getToolUsage("thumb");

    expect(
      prismaMock.usageLog.groupBy.mock.calls[0]![0].where.createdAt.gte.toISOString(),
    ).toBe("2026-03-01T12:00:00.000Z");
  });

  it("summarizes a user's usage with credits spent as a positive number", async () => {
    prismaMock.usageLog.count.mockResolvedValue(12);
    prismaMock.creditTransaction.aggregate.mockResolvedValue({
      _sum: { amount: -85 },
    });
    prismaMock.usageLog.groupBy.mockResolvedValue([
      { toolId: "a" },
      { toolId: "b" },
    ]);

    expect(await service.getUserStats("u1")).toEqual({
      totalUsage: 12,
      totalCreditsSpent: 85,
      toolsUsed: 2,
    });
    expect(
      prismaMock.creditTransaction.aggregate.mock.calls[0]![0].where,
    ).toEqual({
      userId: "u1",
      type: "USAGE",
    });
  });

  it("handles users with no spending", async () => {
    prismaMock.usageLog.count.mockResolvedValue(0);
    prismaMock.creditTransaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    prismaMock.usageLog.groupBy.mockResolvedValue([]);

    expect(await service.getUserStats("u1")).toEqual({
      totalUsage: 0,
      totalCreditsSpent: 0,
      toolsUsed: 0,
    });
  });

  it("builds dashboard totals from purchases and active tools", async () => {
    prismaMock.user.count.mockResolvedValue(40);
    prismaMock.usageLog.count.mockResolvedValue(900);
    prismaMock.tool.count.mockResolvedValue(6);
    prismaMock.creditTransaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    expect(await service.getDashboardStats()).toEqual({
      totalUsers: 40,
      totalUsage: 900,
      activeTools: 6,
      totalRevenue: 0,
    });
    expect(prismaMock.tool.count).toHaveBeenCalledWith({
      where: { status: "active" },
    });
    expect(
      prismaMock.creditTransaction.aggregate.mock.calls[0]![0].where,
    ).toEqual({
      type: "PURCHASE",
    });
  });
});

describe("UsageTracker", () => {
  const queue = { add: vi.fn() };
  const tracker = new UsageTracker(queue as never);

  beforeEach(() => queue.add.mockReset());

  it("enqueues the event and writes a UsageLog row", async () => {
    await tracker.track({
      userId: "u1",
      toolId: "thumb",
      credits: 10,
      duration: 1200,
      metadata: { model: "flux" },
    });

    expect(queue.add).toHaveBeenCalledWith(
      "track-usage",
      expect.objectContaining({ userId: "u1" }),
    );
    expect(prismaMock.usageLog.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        toolId: "thumb",
        credits: 10,
        duration: 1200,
        success: true,
        error: undefined,
        metadata: { model: "flux" },
      },
    });
  });

  it("records failures", async () => {
    await tracker.track({
      userId: "u1",
      toolId: "thumb",
      credits: 0,
      success: false,
      error: "timeout",
    });

    expect(prismaMock.usageLog.create.mock.calls[0]![0].data).toMatchObject({
      success: false,
      error: "timeout",
    });
  });
});

describe("PlatformUsageLogger", () => {
  const tracker = { track: vi.fn() };
  const logger = new PlatformUsageLogger(tracker as never);

  function loggedEntry(log: ReturnType<typeof vi.spyOn>) {
    return JSON.parse(log.mock.calls.at(-1)![0] as string);
  }

  beforeEach(() => tracker.track.mockReset());

  it("logs a structured entry with resolved tool and model names", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    prismaMock.tool.findUnique.mockResolvedValue({
      name: "Thumbnail Generator",
    });
    prismaMock.modelMetadata.findFirst.mockResolvedValue({
      displayName: "FLUX.2 Pro",
    });

    await logger.logUsage({
      userId: "u1",
      toolId: "thumb",
      modelId: "bfl/flux-2-pro",
      duration: 2345,
      success: true,
      credits: 10,
    });

    expect(loggedEntry(log)).toMatchObject({
      message: "Thumbnail Generator completed",
      toolName: "Thumbnail Generator",
      modelName: "FLUX.2 Pro",
      duration: "2.3s",
      durationMs: 2345,
      credits: 10,
      error: null,
    });
    expect(prismaMock.modelMetadata.findFirst.mock.calls[0]![0]).toMatchObject({
      where: { modelId: "bfl/flux-2-pro" },
      orderBy: { isActive: "desc" },
    });
    expect(tracker.track).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        toolId: "thumb",
        credits: 10,
        metadata: { toolName: "Thumbnail Generator", modelName: "FLUX.2 Pro" },
      }),
    );
  });

  it("does not write UsageLog rows for tools missing from the Tool table", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    prismaMock.tool.findUnique.mockResolvedValue(null);

    await logger.logUsage({
      userId: "u1",
      toolId: "chat",
      success: false,
      error: "boom",
    });

    expect(tracker.track).not.toHaveBeenCalled();
    expect(loggedEntry(log)).toMatchObject({
      message: "chat failed",
      toolName: "chat",
      modelId: "n/a",
      duration: "n/a",
      error: "boom",
      credits: 0,
    });
  });

  it("is best-effort when name lookups or the tracker fail", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    prismaMock.tool.findUnique
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ name: "Thumbs" });
    prismaMock.modelMetadata.findFirst.mockRejectedValue(new Error("db down"));
    tracker.track.mockRejectedValue(new Error("queue down"));

    await expect(
      logger.logUsage({
        userId: "u1",
        toolId: "thumb",
        modelId: "m",
        success: true,
      }),
    ).resolves.toBeUndefined();
    await expect(
      logger.logUsage({ userId: "u1", toolId: "thumb", success: true }),
    ).resolves.toBeUndefined();
  });
});
