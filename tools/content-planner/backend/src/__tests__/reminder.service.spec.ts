import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  contentEvent: { findMany: vi.fn(), updateMany: vi.fn() },
  $executeRawUnsafe: vi.fn(),
}));
vi.mock("@creator-hub/database", () => ({ prisma: prismaMock }));

import { ContentPlannerReminderService } from "../reminder.service";

const d = (iso: string) => new Date(iso);
const now = d("2026-03-02T09:45:00.000Z");
const service = new ContentPlannerReminderService();

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  userId: "u1",
  title: `Session ${id}`,
  type: "RECORDING",
  startAt: d("2026-03-02T10:00:00.000Z"),
  endAt: d("2026-03-02T11:00:00.000Z"),
  reminderMinutes: 15,
  customType: null,
  project: null,
  ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  prismaMock.contentEvent.findMany.mockResolvedValue([]);
  prismaMock.contentEvent.updateMany.mockResolvedValue({ count: 1 });
});

describe("claimDueReminders", () => {
  it("only looks at planned, unsent reminders that are due and not long started", async () => {
    await service.claimDueReminders(now);

    expect(prismaMock.contentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          remindAt: { lte: now },
          reminderSentAt: null,
          status: "PLANNED",
          startAt: { gt: d("2026-03-02T09:35:00.000Z") }, // 10-minute grace
        },
        orderBy: { remindAt: "asc" },
        take: 100,
      }),
    );
  });

  it("claims each reminder atomically and returns what it won", async () => {
    prismaMock.contentEvent.findMany.mockResolvedValue([
      row("a", {
        customType: { name: "Podcast" },
        project: { title: "Launch video" },
      }),
      row("b"),
    ]);
    // Another API instance already sent "b".
    prismaMock.contentEvent.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const claimed = await service.claimDueReminders(now);

    expect(prismaMock.contentEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "a", reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    expect(claimed).toEqual([
      {
        eventId: "a",
        userId: "u1",
        title: "Session a",
        type: "RECORDING",
        customTypeName: "Podcast",
        projectTitle: "Launch video",
        startAt: d("2026-03-02T10:00:00.000Z"),
        endAt: d("2026-03-02T11:00:00.000Z"),
        reminderMinutes: 15,
      },
    ]);
  });
});

describe("backfillRemindAt", () => {
  it("fills only upcoming sessions that have a reminder but no remindAt", async () => {
    prismaMock.$executeRawUnsafe.mockResolvedValue(3);
    expect(await service.backfillRemindAt()).toBe(3);
    const sql = prismaMock.$executeRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/"remindAt" IS NULL/);
    expect(sql).toMatch(/"reminderMinutes" IS NOT NULL/);
    expect(sql).toMatch(/"startAt" > NOW\(\)/);
  });
});
