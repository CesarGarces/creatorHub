import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VOICE_SETTINGS } from "@creator-hub/shared-types";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  voiceUsage: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@creator-hub/database", () => ({ prisma: db }));

import { VoiceAllowanceService } from "../voice-allowance.service";

const NOW = new Date("2026-11-29T10:00:00Z");

function setup(
  freeTier: { minutes: number | null; period: "monthly" | "lifetime" },
  plan = "FREE",
) {
  const settings = {
    get: vi.fn(async () => ({ ...DEFAULT_VOICE_SETTINGS, freeTier })),
  };
  db.user.findUnique.mockResolvedValue({ plan });
  return new VoiceAllowanceService(settings as never);
}

beforeEach(() => {
  db.user.findUnique.mockReset();
  db.voiceUsage.findUnique.mockReset();
  db.voiceUsage.upsert.mockReset().mockResolvedValue({});
});

describe("VoiceAllowanceService", () => {
  it("gives a Free user what is left of the month", async () => {
    db.voiceUsage.findUnique.mockResolvedValue({ seconds: 450 });
    const allowance = await setup({ minutes: 10, period: "monthly" }).get(
      "u1",
      NOW,
    );
    expect(db.voiceUsage.findUnique).toHaveBeenCalledWith({
      where: { userId_period: { userId: "u1", period: "2026-11" } },
      select: { seconds: true },
    });
    expect(allowance).toMatchObject({
      limited: true,
      limitSeconds: 600,
      usedSeconds: 450,
      remainingSeconds: 150,
      exhausted: false,
      resetsAt: "2026-12-01T00:00:00.000Z",
    });
  });

  it("checks the total for a lifetime limit, and says when it's used up", async () => {
    db.voiceUsage.findUnique.mockResolvedValue({ seconds: 1300 });
    const allowance = await setup({ minutes: 20, period: "lifetime" }).get(
      "u1",
      NOW,
    );
    expect(db.voiceUsage.findUnique.mock.calls[0]![0].where).toEqual({
      userId_period: { userId: "u1", period: "all" },
    });
    expect(allowance).toMatchObject({ remainingSeconds: 0, exhausted: true });
  });

  it("never limits paid plans, nor anyone when no limit is set", async () => {
    expect(
      await setup({ minutes: 10, period: "monthly" }, "PRO").get("u1", NOW),
    ).toMatchObject({ limited: false, exhausted: false });
    expect(
      await setup({ minutes: null, period: "monthly" }).get("u1", NOW),
    ).toMatchObject({ limited: false, exhausted: false });
    expect(db.voiceUsage.findUnique).not.toHaveBeenCalled();
  });

  it("doesn't block the user if the usage can't be read", async () => {
    db.voiceUsage.findUnique.mockRejectedValue(new Error("db down"));
    expect(
      await setup({ minutes: 10, period: "monthly" }).get("u1", NOW),
    ).toMatchObject({ usedSeconds: 0, exhausted: false });
  });

  it("counts every started second of Free users, in the month and in total", async () => {
    const service = setup({ minutes: 10, period: "monthly" });
    await service.record("u1", 2300, NOW);
    expect(db.voiceUsage.upsert).toHaveBeenCalledTimes(2);
    expect(db.voiceUsage.upsert).toHaveBeenCalledWith({
      where: { userId_period: { userId: "u1", period: "2026-11" } },
      create: { userId: "u1", period: "2026-11", seconds: 3 },
      update: { seconds: { increment: 3 } },
    });
    expect(db.voiceUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_period: { userId: "u1", period: "all" } },
      }),
    );
  });

  it("doesn't count paid plans or nothing at all", async () => {
    await setup({ minutes: 10, period: "monthly" }, "STARTER").record(
      "u1",
      5000,
      NOW,
    );
    await setup({ minutes: 10, period: "monthly" }).record("u1", 0, NOW);
    expect(db.voiceUsage.upsert).not.toHaveBeenCalled();
  });
});
