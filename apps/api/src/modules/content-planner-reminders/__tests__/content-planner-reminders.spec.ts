import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { DueReminder } from "@creator-hub/content-planner-backend";
import {
  ContentPlannerRemindersService,
  reminderText,
} from "../content-planner-reminders.service";
import { ContentPlannerRemindersModule } from "../content-planner-reminders.module";
import { NotificationModule } from "../../notification/notification.module";
import { NotificationService } from "../../notification/notification.service";
import { WebsocketModule } from "../../websocket/websocket.module";
import { AppGateway } from "../../websocket/websocket.gateway";

const now = new Date("2026-03-02T09:45:00.000Z");

const due = (over: Partial<DueReminder> = {}): DueReminder => ({
  eventId: "e1",
  userId: "u1",
  title: "Record intro",
  type: "RECORDING",
  customTypeName: null,
  projectTitle: "Launch video",
  startAt: new Date("2026-03-02T10:00:00.000Z"),
  endAt: new Date("2026-03-02T11:00:00.000Z"),
  reminderMinutes: 15,
  ...over,
});

function setup() {
  const reminders = {
    claimDueReminders: vi.fn().mockResolvedValue([]),
    backfillRemindAt: vi.fn().mockResolvedValue(0),
  };
  const notifications = {
    create: vi.fn(async (dto: Record<string, unknown>) => ({
      id: "n1",
      ...dto,
    })),
  };
  const gateway = { emitToUser: vi.fn() };
  const service = new ContentPlannerRemindersService(
    reminders as never,
    notifications as never,
    gateway as never,
  );
  return { service, reminders, notifications, gateway };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  // Failures are logged on purpose in some tests; keep the output clean.
  Logger.overrideLogger(false);
});
afterEach(() => {
  delete process.env.CONTENT_PLANNER_REMINDERS;
  delete process.env.CONTENT_PLANNER_REMINDER_INTERVAL_MS;
  vi.useRealTimers();
});

describe("ContentPlannerRemindersService.tick", () => {
  it("stores a SESSION_REMINDER notification and pushes it to the user live", async () => {
    const { service, reminders, notifications, gateway } = setup();
    reminders.claimDueReminders.mockResolvedValue([due()]);

    expect(await service.tick(now)).toBe(1);

    expect(reminders.claimDueReminders).toHaveBeenCalledWith(now);
    expect(notifications.create).toHaveBeenCalledWith({
      userId: "u1",
      type: "SESSION_REMINDER",
      title: "Upcoming session",
      body: '"Record intro" starts in 15 minutes',
      data: {
        kind: "session-reminder",
        eventId: "e1",
        eventTitle: "Record intro",
        startAt: "2026-03-02T10:00:00.000Z",
        endAt: "2026-03-02T11:00:00.000Z",
        reminderMinutes: 15,
        type: "RECORDING",
        customTypeName: null,
        projectTitle: "Launch video",
      },
    });
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      "u1",
      "notification:new",
      expect.objectContaining({ id: "n1", type: "SESSION_REMINDER" }),
    );
  });

  it("keeps notifying other users when one reminder fails", async () => {
    const { service, reminders, notifications, gateway } = setup();
    reminders.claimDueReminders.mockResolvedValue([
      due({ eventId: "bad", userId: "u1" }),
      due({ eventId: "ok", userId: "u2" }),
    ]);
    notifications.create.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(await service.tick(now)).toBe(1);
    expect(gateway.emitToUser).toHaveBeenCalledTimes(1);
    expect(gateway.emitToUser.mock.calls[0]?.[0]).toBe("u2");
  });

  it("survives a failing poll", async () => {
    const { service, reminders } = setup();
    reminders.claimDueReminders.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(service.tick(now)).resolves.toBe(0);
  });

  it("skips a round while the previous one is still running", async () => {
    const { service, reminders } = setup();
    let release!: () => void;
    reminders.claimDueReminders.mockReturnValueOnce(
      new Promise((r) => (release = () => r([]))),
    );
    const first = service.tick(now);
    expect(await service.tick(now)).toBe(0);
    expect(reminders.claimDueReminders).toHaveBeenCalledTimes(1);
    release();
    await first;
  });
});

describe("polling lifecycle", () => {
  it("backfills once and polls on the configured interval until destroyed", async () => {
    vi.useFakeTimers();
    process.env.CONTENT_PLANNER_REMINDER_INTERVAL_MS = "1000";
    const { service, reminders } = setup();

    service.onModuleInit();
    expect(reminders.backfillRemindAt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(reminders.claimDueReminders).toHaveBeenCalledTimes(3);

    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(reminders.claimDueReminders).toHaveBeenCalledTimes(3);
  });

  it("can be switched off", async () => {
    vi.useFakeTimers();
    process.env.CONTENT_PLANNER_REMINDERS = "off";
    const { service, reminders } = setup();
    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(reminders.claimDueReminders).not.toHaveBeenCalled();
    expect(reminders.backfillRemindAt).not.toHaveBeenCalled();
  });
});

describe("reminderText (English fallback)", () => {
  const start = new Date("2026-03-02T10:00:00.000Z");
  const at = (minutesBefore: number) =>
    new Date(start.getTime() - minutesBefore * 60_000);

  it("describes how soon the session starts", () => {
    expect(reminderText("Shoot", start, at(0))).toBe('"Shoot" is starting now');
    expect(reminderText("Shoot", start, at(-3))).toBe(
      '"Shoot" is starting now',
    );
    expect(reminderText("Shoot", start, at(1))).toBe(
      '"Shoot" starts in 1 minute',
    );
    expect(reminderText("Shoot", start, at(30))).toBe(
      '"Shoot" starts in 30 minutes',
    );
    expect(reminderText("Shoot", start, at(60))).toBe(
      '"Shoot" starts in 1 hour',
    );
    expect(reminderText("Shoot", start, at(120))).toBe(
      '"Shoot" starts in 2 hours',
    );
    expect(reminderText("Shoot", start, at(1440))).toBe(
      '"Shoot" starts in 1 day',
    );
  });
});

describe("module wiring", () => {
  it("resolves the service with the planner, notification and websocket providers", async () => {
    const gateway = { emitToUser: vi.fn() };
    @Module({
      providers: [{ provide: AppGateway, useValue: gateway }],
      exports: [AppGateway],
    })
    class FakeWebsocketModule {}
    @Module({
      providers: [
        { provide: NotificationService, useValue: { create: vi.fn() } },
      ],
      exports: [NotificationService],
    })
    class FakeNotificationModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [ContentPlannerRemindersModule],
    })
      .overrideModule(WebsocketModule)
      .useModule(FakeWebsocketModule)
      .overrideModule(NotificationModule)
      .useModule(FakeNotificationModule)
      .compile();

    const service = moduleRef.get(ContentPlannerRemindersService);
    expect(service).toBeInstanceOf(ContentPlannerRemindersService);
    await moduleRef.close();
  });
});
