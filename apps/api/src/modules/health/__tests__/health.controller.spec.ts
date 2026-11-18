import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";

const db = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@creator-hub/database", () => ({
  prisma: { $queryRaw: db.queryRaw },
}));

import { HealthController } from "../health.controller";

describe("HealthController", () => {
  const controller = new HealthController();

  beforeEach(() => vi.clearAllMocks());

  it("reports liveness", () => {
    expect(controller.health()).toEqual({
      status: "ok",
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  it("reports readiness when the database responds", async () => {
    db.queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    await expect(controller.ready()).resolves.toEqual({
      status: "ready",
      database: "up",
      timestamp: expect.any(String),
    });
  });

  it("returns 503 when the database is unavailable", async () => {
    db.queryRaw.mockRejectedValue(new Error("connection refused"));

    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
