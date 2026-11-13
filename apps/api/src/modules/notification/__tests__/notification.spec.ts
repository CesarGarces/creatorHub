import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpStatus, NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA, HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { NotificationService } from "../notification.service";
import { NotificationController } from "../notification.controller";

describe("NotificationService", () => {
  const service = new NotificationService();

  beforeEach(() => resetPrismaMock());

  it("creates a notification", async () => {
    prismaMock.notification.create.mockImplementation(async ({ data }) => ({
      id: "n1",
      ...data,
    }));

    const result = await service.create({
      userId: "u1",
      type: "SYSTEM" as never,
      title: "Welcome",
      data: { foo: 1 },
    });

    expect(result).toMatchObject({
      id: "n1",
      userId: "u1",
      title: "Welcome",
      data: { foo: 1 },
    });
  });

  describe("findAllByUser", () => {
    beforeEach(() => {
      prismaMock.notification.findMany.mockResolvedValue([{ id: "n1" }]);
      prismaMock.notification.count
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(3);
    });

    it("paginates newest-first and reports totals", async () => {
      const result = await service.findAllByUser("u1", {
        limit: 5,
        offset: 10,
      });

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        orderBy: { createdAt: "desc" },
        take: 5,
        skip: 10,
      });
      expect(result).toEqual({
        notifications: [{ id: "n1" }],
        total: 12,
        unreadCount: 3,
      });
    });

    it("filters to unread notifications when requested", async () => {
      await service.findAllByUser("u1", { unreadOnly: true });

      expect(prismaMock.notification.findMany.mock.calls[0]![0]).toMatchObject({
        where: { userId: "u1", readAt: null },
        take: 20,
        skip: 0,
      });
    });
  });

  it("findOne only returns the user's own notification", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await expect(service.findOne("n-of-u2", "u1")).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.notification.findFirst).toHaveBeenCalledWith({
      where: { id: "n-of-u2", userId: "u1" },
    });
  });

  describe("markAsRead", () => {
    it("sets readAt on an unread notification", async () => {
      prismaMock.notification.findFirst.mockResolvedValue({
        id: "n1",
        readAt: null,
      });
      prismaMock.notification.update.mockResolvedValue({
        id: "n1",
        readAt: new Date(),
      });

      await service.markAsRead("n1", "u1");

      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { readAt: expect.any(Date) },
      });
    });

    it("is a no-op for an already-read notification", async () => {
      const readAt = new Date("2026-01-01");
      prismaMock.notification.findFirst.mockResolvedValue({ id: "n1", readAt });

      expect(await service.markAsRead("n1", "u1")).toEqual({
        id: "n1",
        readAt,
      });
      expect(prismaMock.notification.update).not.toHaveBeenCalled();
    });

    it("cannot mark another user's notification", async () => {
      prismaMock.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead("n-of-u2", "u1")).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.notification.update).not.toHaveBeenCalled();
    });
  });

  it("markAllAsRead only touches the user's unread notifications", async () => {
    await service.markAllAsRead("u1");

    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it("remove verifies ownership before deleting", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);
    await expect(service.remove("n-of-u2", "u1")).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.notification.delete).not.toHaveBeenCalled();

    prismaMock.notification.findFirst.mockResolvedValue({ id: "n1" });
    await service.remove("n1", "u1");
    expect(prismaMock.notification.delete).toHaveBeenCalledWith({
      where: { id: "n1" },
    });
  });

  it("removeAll and getUnreadCount are scoped to the user", async () => {
    prismaMock.notification.count.mockResolvedValue(4);

    await service.removeAll("u1");
    expect(await service.getUnreadCount("u1")).toBe(4);

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
    });
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: "u1", readAt: null },
    });
  });
});

describe("NotificationController", () => {
  const service = {
    findAllByUser: vi.fn(),
    getUnreadCount: vi.fn(),
    findOne: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
  };
  const controller = new NotificationController(service as never);
  const req = { user: { id: "u1" } };

  beforeEach(() => vi.clearAllMocks());

  it("requires authentication", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, NotificationController),
    ).toEqual([JwtAuthGuard]);
  });

  it("applies default pagination", async () => {
    await controller.findAll(req);

    expect(service.findAllByUser).toHaveBeenCalledWith("u1", {
      limit: 20,
      offset: 0,
      unreadOnly: false,
    });
  });

  it("parses query parameters; only the string 'true' enables unreadOnly", async () => {
    await controller.findAll(req, "5", "15", "true");
    await controller.findAll(req, undefined, undefined, "1");

    expect(service.findAllByUser).toHaveBeenNthCalledWith(1, "u1", {
      limit: 5,
      offset: 15,
      unreadOnly: true,
    });
    expect(service.findAllByUser.mock.calls[1]![1].unreadOnly).toBe(false);
  });

  it("wraps the unread count", async () => {
    service.getUnreadCount.mockResolvedValue(7);
    expect(await controller.getUnreadCount(req)).toEqual({ count: 7 });
  });

  it("passes the authenticated user id to every per-notification action", async () => {
    await controller.findOne(req, "n1");
    await controller.markAsRead(req, "n1");
    await controller.remove(req, "n1");
    await controller.markAllAsRead(req);
    await controller.removeAll(req);

    expect(service.findOne).toHaveBeenCalledWith("n1", "u1");
    expect(service.markAsRead).toHaveBeenCalledWith("n1", "u1");
    expect(service.remove).toHaveBeenCalledWith("n1", "u1");
    expect(service.markAllAsRead).toHaveBeenCalledWith("u1");
    expect(service.removeAll).toHaveBeenCalledWith("u1");
  });

  it.each(["markAllAsRead", "remove", "removeAll"] as const)(
    "%s responds with 204 No Content",
    (method) => {
      expect(
        Reflect.getMetadata(
          HTTP_CODE_METADATA,
          NotificationController.prototype[method],
        ),
      ).toBe(HttpStatus.NO_CONTENT);
    },
  );
});
