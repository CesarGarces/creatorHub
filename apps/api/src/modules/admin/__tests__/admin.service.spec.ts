import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { Prisma } from "@creator-hub/database";
import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { AdminService } from "../admin.service";
import { ProviderTierDto } from "../dto/provider.dto";
import { UserRoleDto } from "../dto/user.dto";

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(() => {
    resetPrismaMock();
    service = new AdminService();
  });

  // ───────────────────────────── Providers ─────────────────────────────

  describe("findAllProviders", () => {
    it("clamps page/limit and returns pagination meta", async () => {
      prismaMock.provider.findMany.mockResolvedValue([{ id: "p1" }]);
      prismaMock.provider.count.mockResolvedValue(250);

      const result = await service.findAllProviders({ page: 0, limit: 500 });

      const args = prismaMock.provider.findMany.mock.calls[0]![0];
      expect(args.skip).toBe(0);
      expect(args.take).toBe(100);
      expect(result.meta).toEqual({
        page: 1,
        limit: 100,
        total: 250,
        totalPages: 3,
      });
    });

    it("builds search, tier and isActive=false filters", async () => {
      prismaMock.provider.findMany.mockResolvedValue([]);
      prismaMock.provider.count.mockResolvedValue(0);

      await service.findAllProviders({
        page: 2,
        limit: 10,
        search: "flux",
        tier: "PRO",
        isActive: false,
      });

      const { where, skip } = prismaMock.provider.findMany.mock.calls[0]![0];
      expect(skip).toBe(10);
      expect(where.tier).toBe("PRO");
      expect(where.isActive).toBe(false);
      expect(where.OR).toEqual([
        { slug: { contains: "flux", mode: "insensitive" } },
        { name: { contains: "flux", mode: "insensitive" } },
        { model: { contains: "flux", mode: "insensitive" } },
      ]);
      expect(prismaMock.provider.count).toHaveBeenCalledWith({ where });
    });
  });

  describe("createProvider", () => {
    const dto = {
      slug: "flux-pro",
      name: "Flux Pro",
      model: "black-forest/flux-pro",
      tier: ProviderTierDto.PRO,
      costPerCredit: 5,
      supportedTasks: ["image-generation"],
    };

    it("rejects a duplicate slug", async () => {
      prismaMock.provider.findUnique.mockResolvedValue({ id: "existing" });

      await expect(service.createProvider(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.provider.create).not.toHaveBeenCalled();
    });

    it("defaults isActive to true and stores JsonNull when no config is given", async () => {
      prismaMock.provider.findUnique.mockResolvedValue(null);
      prismaMock.provider.create.mockImplementation(async ({ data }) => data);

      await service.createProvider(dto);

      const { data } = prismaMock.provider.create.mock.calls[0]![0];
      expect(data.isActive).toBe(true);
      expect(data.config).toBe(Prisma.JsonNull);
    });
  });

  describe("updateProvider", () => {
    it("throws NotFound for an unknown provider", async () => {
      prismaMock.provider.findUnique.mockResolvedValue(null);

      await expect(service.updateProvider("missing", {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it("refuses to deactivate a gateway provider", async () => {
      prismaMock.provider.findUnique.mockResolvedValue({
        id: "gw",
        slug: "openrouter",
        isGateway: true,
      });

      await expect(
        service.updateProvider("gw", { isActive: false }),
      ).rejects.toThrow(/cannot be deactivated/);
      expect(prismaMock.provider.update).not.toHaveBeenCalled();
    });

    it("rejects a slug already used by another provider", async () => {
      prismaMock.provider.findUnique.mockResolvedValue({ id: "p1" });
      prismaMock.provider.findFirst.mockResolvedValue({ id: "p2" });

      await expect(
        service.updateProvider("p1", { slug: "taken" }),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.provider.findFirst).toHaveBeenCalledWith({
        where: { slug: "taken", id: { not: "p1" } },
      });
    });

    it("only writes the fields that were provided", async () => {
      prismaMock.provider.findUnique.mockResolvedValue({
        id: "p1",
        isGateway: false,
      });
      prismaMock.provider.update.mockResolvedValue({ id: "p1" });

      await service.updateProvider("p1", { name: "Renamed", costPerCredit: 0 });

      expect(prismaMock.provider.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { name: "Renamed", costPerCredit: 0 },
      });
    });
  });

  describe("deleteProvider", () => {
    it("refuses to delete a gateway provider", async () => {
      prismaMock.provider.findUnique.mockResolvedValue({
        id: "gw",
        slug: "openrouter",
        isGateway: true,
      });

      await expect(service.deleteProvider("gw")).rejects.toThrow(
        /cannot be deleted/,
      );
      expect(prismaMock.provider.delete).not.toHaveBeenCalled();
    });

    it("deletes a regular provider", async () => {
      prismaMock.provider.findUnique.mockResolvedValue({
        id: "p1",
        isGateway: false,
      });
      prismaMock.provider.delete.mockResolvedValue({ id: "p1" });

      await service.deleteProvider("p1");

      expect(prismaMock.provider.delete).toHaveBeenCalledWith({
        where: { id: "p1" },
      });
    });
  });

  // ─────────────────────────────── Users ───────────────────────────────

  describe("createUser", () => {
    it("rejects an email that is already registered", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1" });

      await expect(
        service.createUser({
          email: "dup@x.com",
          name: "Dup",
          password: "Str0ng!Pass",
        }),
      ).rejects.toThrow("User with this email already exists");
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("stores a bcrypt hash (never the plaintext) and applies defaults", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.user.create.mockResolvedValue({
        id: "u1",
        currentCredits: 100,
        purchasedCredits: 0,
      });

      const result = await service.createUser({
        email: "new@x.com",
        name: "New",
        password: "Str0ng!Pass",
      });

      const { data, select } = prismaMock.user.create.mock.calls[0]![0];
      expect(data.passwordHash).not.toBe("Str0ng!Pass");
      expect(await bcrypt.compare("Str0ng!Pass", data.passwordHash)).toBe(true);
      expect(data).toMatchObject({
        role: "USER",
        plan: "FREE",
        currentCredits: 100,
        purchasedCredits: 0,
        isActive: true,
      });
      expect(select.passwordHash).toBeUndefined();
      expect(result.totalCredits).toBe(100);
    });
  });

  describe("updateUser", () => {
    it("throws NotFound for an unknown user", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUser("x", {}, "admin")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("prevents an admin from deactivating their own account", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "a1", role: "ADMIN" });

      await expect(
        service.updateUser("a1", { isActive: false }, "a1"),
      ).rejects.toThrow(ForbiddenException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("prevents deactivating the last active admin", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "a2", role: "ADMIN" });
      prismaMock.user.count.mockResolvedValue(0);

      await expect(service.deactivateUser("a2", "a1")).rejects.toThrow(
        "Cannot deactivate the last active admin",
      );
      expect(prismaMock.user.count).toHaveBeenCalledWith({
        where: { role: "ADMIN", isActive: true, id: { not: "a2" } },
      });
    });

    it("allows deactivating an admin when another active admin remains", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "a2", role: "ADMIN" });
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.user.update.mockResolvedValue({
        id: "a2",
        currentCredits: 10,
        purchasedCredits: 5,
        isActive: false,
      });

      const result = await service.deactivateUser("a2", "a1");

      expect(prismaMock.user.update.mock.calls[0]![0].data).toEqual({
        isActive: false,
      });
      expect(result.totalCredits).toBe(15);
    });

    it("rejects changing the email to one owned by another user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "old@x.com",
      });
      prismaMock.user.findFirst.mockResolvedValue({ id: "u2" });

      await expect(
        service.updateUser("u1", { email: "taken@x.com" }, "admin"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-hashes a new password and can promote a user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "USER" });
      prismaMock.user.update.mockResolvedValue({
        id: "u1",
        currentCredits: 0,
        purchasedCredits: 0,
      });

      await service.updateUser(
        "u1",
        { password: "N3w!Password", role: UserRoleDto.ADMIN },
        "admin",
      );

      const { data } = prismaMock.user.update.mock.calls[0]![0];
      expect(data.role).toBe("ADMIN");
      expect(await bcrypt.compare("N3w!Password", data.passwordHash)).toBe(
        true,
      );
    });

    it("activateUser re-enables an account", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", role: "USER" });
      prismaMock.user.update.mockResolvedValue({
        id: "u1",
        currentCredits: 0,
        purchasedCredits: 0,
      });

      await service.activateUser("u1", "admin");

      expect(prismaMock.user.update.mock.calls[0]![0].data).toEqual({
        isActive: true,
      });
    });
  });

  describe("findAllUsers / findUserById", () => {
    it("filters by role/plan/search and never selects the password hash", async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: "u1", currentCredits: 7, purchasedCredits: 3 },
      ]);
      prismaMock.user.count.mockResolvedValue(1);

      const result = await service.findAllUsers({
        search: "ana",
        role: "ADMIN",
        plan: "PRO",
      });

      const { where, select } = prismaMock.user.findMany.mock.calls[0]![0];
      expect(where).toMatchObject({ role: "ADMIN", plan: "PRO" });
      expect(where.OR).toHaveLength(2);
      expect(select.passwordHash).toBeUndefined();
      expect(result.data[0].totalCredits).toBe(7);
    });

    it("throws NotFound for an unknown user id", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.findUserById("nope")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ───────────────────────────── Dashboard ─────────────────────────────

  describe("dashboard", () => {
    it("getDashboardStats reports usage as a positive number and sums remaining credits", async () => {
      prismaMock.user.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(2);
      prismaMock.provider.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(4);
      prismaMock.creditTransaction.aggregate.mockResolvedValue({
        _sum: { amount: -340 },
      });
      prismaMock.toolFavorite.count.mockResolvedValue(12);
      prismaMock.user.aggregate.mockResolvedValue({
        _sum: { currentCredits: 900, purchasedCredits: null },
      });

      expect(await service.getDashboardStats()).toEqual({
        totalUsers: 10,
        activeUsers: 8,
        inactiveUsers: 2,
        totalProviders: 5,
        activeProviders: 4,
        totalCreditsUsed: 340,
        totalCreditsRemaining: 900,
        totalFavorites: 12,
      });
    });

    it("getTopUsers falls back to placeholders for deleted users", async () => {
      prismaMock.usageLog.groupBy.mockResolvedValue([
        { userId: "u1", _count: { userId: 4 }, _sum: { credits: -40 } },
        { userId: "gone", _count: { userId: 1 }, _sum: { credits: null } },
      ]);
      prismaMock.user.findMany.mockResolvedValue([
        { id: "u1", name: "Ana", email: "ana@x.com", plan: "PRO" },
      ]);

      const { users } = await service.getTopUsers(5);

      expect(users).toEqual([
        {
          userId: "u1",
          userName: "Ana",
          userEmail: "ana@x.com",
          userPlan: "PRO",
          usageCount: 4,
          creditsUsed: 40,
        },
        {
          userId: "gone",
          userName: "Unknown",
          userEmail: "Unknown",
          userPlan: "FREE",
          usageCount: 1,
          creditsUsed: 0,
        },
      ]);
    });

    it("getUsageByProvider and getFavoriteStats map grouped rows", async () => {
      prismaMock.usageLog.groupBy.mockResolvedValue([
        { toolId: "thumb", _count: { userId: 3 }, _sum: { credits: -30 } },
      ]);
      prismaMock.toolFavorite.groupBy.mockResolvedValue([
        { toolId: "thumb", _count: { id: 9 } },
      ]);

      expect(await service.getUsageByProvider(3)).toEqual({
        byProvider: [{ toolId: "thumb", usageCount: 3, totalCredits: 30 }],
      });
      expect(await service.getFavoriteStats(3)).toEqual({
        byTool: [{ toolId: "thumb", favoriteCount: 9 }],
      });
    });

    it("getRegistrations returns one bucket per day, including empty days", async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { createdAt: new Date(2026, 0, 1, 9, 0) },
        { createdAt: new Date(2026, 0, 1, 18, 30) },
        { createdAt: new Date(2026, 0, 3, 12, 0) },
      ]);

      const { byDay } = await service.getRegistrations(
        "2026-01-01T12:00:00",
        "2026-01-03T12:00:00",
      );

      expect(byDay).toEqual([
        { date: "2026-01-01", count: 2 },
        { date: "2026-01-02", count: 0 },
        { date: "2026-01-03", count: 1 },
      ]);
      const { where } = prismaMock.user.findMany.mock.calls[0]![0];
      expect(where.createdAt.gte).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
      expect(where.createdAt.lte).toEqual(
        new Date(2026, 0, 3, 23, 59, 59, 999),
      );
    });
  });

  // ──────────────────────── Credit plans & Modes ────────────────────────

  describe("credit plans", () => {
    it("rejects a duplicate plan slug on create", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue({ id: "c1" });

      await expect(
        service.createCreditPlan({
          slug: "STARTER",
          name: "Starter",
          usdAmount: 10,
          creditsGiven: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates a plan with default sort order and active flag", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue(null);
      prismaMock.creditPlan.create.mockResolvedValue({ id: "c1" });

      await service.createCreditPlan({
        slug: "STARTER",
        name: "Starter",
        usdAmount: 10,
        creditsGiven: 1000,
      });

      expect(prismaMock.creditPlan.create.mock.calls[0]![0].data).toMatchObject(
        { isActive: true, sortOrder: 0, usdAmount: 10, creditsGiven: 1000 },
      );
    });

    it("throws NotFound when updating or deleting an unknown plan", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue(null);

      await expect(service.updateCreditPlan("x", {})).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deleteCreditPlan("x")).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.creditPlan.delete).not.toHaveBeenCalled();
    });

    it("findCreditPlanBySlug throws NotFound for an unknown slug", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue(null);
      await expect(service.findCreditPlanBySlug("NOPE")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("modes", () => {
    it("rejects a duplicate mode slug", async () => {
      prismaMock.mode.findUnique.mockResolvedValue({ id: "m1" });

      await expect(
        service.createMode({ slug: "image", name: "Image" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects renaming a mode to a slug used by another mode", async () => {
      prismaMock.mode.findUnique.mockResolvedValue({ id: "m1" });
      prismaMock.mode.findFirst.mockResolvedValue({ id: "m2" });

      await expect(service.updateMode("m1", { slug: "video" })).rejects.toThrow(
        BadRequestException,
      );
    });

    it("setToolModes replaces the tool's modes", async () => {
      prismaMock.tool.findUnique.mockResolvedValue({ id: "t1" });

      await service.setToolModes("t1", ["m1", "m2"]);

      expect(prismaMock.toolMode.deleteMany).toHaveBeenCalledWith({
        where: { toolId: "t1" },
      });
      expect(prismaMock.toolMode.createMany).toHaveBeenCalledWith({
        data: [
          { toolId: "t1", modeId: "m1" },
          { toolId: "t1", modeId: "m2" },
        ],
      });
    });

    it("setToolModes with an empty list only clears modes", async () => {
      prismaMock.tool.findUnique.mockResolvedValue({ id: "t1" });

      await service.setToolModes("t1", []);

      expect(prismaMock.toolMode.deleteMany).toHaveBeenCalled();
      expect(prismaMock.toolMode.createMany).not.toHaveBeenCalled();
    });

    it("setToolModes / setProviderModes throw NotFound for unknown ids", async () => {
      prismaMock.tool.findUnique.mockResolvedValue(null);
      prismaMock.provider.findUnique.mockResolvedValue(null);

      await expect(service.setToolModes("x", ["m1"])).rejects.toThrow(
        "Tool not found",
      );
      await expect(service.setProviderModes("x", ["m1"])).rejects.toThrow(
        "Provider not found",
      );
      expect(prismaMock.toolMode.deleteMany).not.toHaveBeenCalled();
      expect(prismaMock.providerMode.deleteMany).not.toHaveBeenCalled();
    });

    it("findAllToolsWithModes flattens the join table", async () => {
      prismaMock.tool.findMany.mockResolvedValue([
        {
          id: "t1",
          name: "Thumbs",
          description: "d",
          icon: "i",
          category: "thumbnail",
          status: "active",
          creditsPerUse: 10,
          modes: [{ mode: { id: "m1", slug: "image" } }],
        },
      ]);

      const [tool] = await service.findAllToolsWithModes();

      expect(tool.modes).toEqual([{ id: "m1", slug: "image" }]);
    });
  });

  // ─────────────────────────── Model metadata ───────────────────────────

  describe("models", () => {
    it("findAllModels supports tag filters and 'newest' sorting", async () => {
      prismaMock.modelMetadata.findMany.mockResolvedValue([]);
      prismaMock.modelMetadata.count.mockResolvedValue(0);

      await service.findAllModels({ tags: ["fast"], sort: "newest" });

      const { where, orderBy } =
        prismaMock.modelMetadata.findMany.mock.calls[0]![0];
      expect(where.tags).toEqual({ hasSome: ["fast"] });
      expect(orderBy).toEqual([{ integratedAt: "desc" }, { id: "asc" }]);
    });

    it("findAllModels uses tier/taskType/name ordering by default", async () => {
      prismaMock.modelMetadata.findMany.mockResolvedValue([]);
      prismaMock.modelMetadata.count.mockResolvedValue(0);

      await service.findAllModels({});

      expect(
        prismaMock.modelMetadata.findMany.mock.calls[0]![0].orderBy,
      ).toEqual([{ tier: "asc" }, { taskType: "asc" }, { displayName: "asc" }]);
    });

    it("updateModelConfig throws NotFound for an unknown model", async () => {
      prismaMock.modelMetadata.findUnique.mockResolvedValue(null);

      await expect(
        service.updateModelConfig("x", { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });

    const activatedModel = {
      id: "mm1",
      modelId: "deepseek-ai/DeepSeek-V4",
      displayName: "DeepSeek V4 (Chat)",
      tier: "FREE",
      creditCost: 2,
      isActive: true,
      taskType: "text-generation",
      providerSlug: "siliconflow",
    };

    it("creates a matching Provider when a model is activated", async () => {
      prismaMock.modelMetadata.findUnique.mockResolvedValue({ id: "mm1" });
      prismaMock.modelMetadata.update.mockResolvedValue(activatedModel);
      prismaMock.provider.findFirst.mockResolvedValue(null);
      prismaMock.provider.findUnique.mockResolvedValue(null);

      await service.updateModelConfig("mm1", { isActive: true });

      expect(prismaMock.provider.create).toHaveBeenCalledWith({
        data: {
          slug: "deepseek-v4-chat",
          name: "DeepSeek V4 (Chat)",
          model: "deepseek-ai/DeepSeek-V4",
          tier: "FREE",
          costPerCredit: 2,
          isActive: true,
          supportedTasks: ["text-generation", "translator"],
        },
      });
    });

    it("updates the existing Provider instead of creating a duplicate", async () => {
      prismaMock.modelMetadata.findUnique.mockResolvedValue({ id: "mm1" });
      prismaMock.modelMetadata.update.mockResolvedValue({
        ...activatedModel,
        isActive: false,
        taskType: "image-generation",
      });
      prismaMock.provider.findFirst.mockResolvedValue({ id: "prov-1" });

      await service.updateModelConfig("mm1", { isActive: false });

      expect(prismaMock.provider.create).not.toHaveBeenCalled();
      expect(prismaMock.provider.update).toHaveBeenCalledWith({
        where: { id: "prov-1" },
        data: expect.objectContaining({
          isActive: false,
          supportedTasks: ["image-generation"],
        }),
      });
    });

    it("does not create a Provider for an inactive model", async () => {
      prismaMock.modelMetadata.findUnique.mockResolvedValue({ id: "mm1" });
      prismaMock.modelMetadata.update.mockResolvedValue({
        ...activatedModel,
        isActive: false,
      });
      prismaMock.provider.findFirst.mockResolvedValue(null);

      await service.updateModelConfig("mm1", { isActive: false });

      expect(prismaMock.provider.create).not.toHaveBeenCalled();
    });

    describe("when provider sync fails", () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      afterEach(() => consoleError.mockClear());

      it("still returns the updated model", async () => {
        prismaMock.modelMetadata.findUnique.mockResolvedValue({ id: "mm1" });
        prismaMock.modelMetadata.update.mockResolvedValue(activatedModel);
        prismaMock.provider.findFirst.mockRejectedValue(new Error("db down"));

        await expect(
          service.updateModelConfig("mm1", { isActive: true }),
        ).resolves.toBe(activatedModel);
        expect(consoleError).toHaveBeenCalled();
      });
    });

    it("bulkUpdateModels returns the number of updated rows", async () => {
      prismaMock.modelMetadata.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkUpdateModels(["a", "b", "c"], {
        creditCost: 4,
      });

      expect(result).toEqual({ updated: 3 });
      const { where, data } =
        prismaMock.modelMetadata.updateMany.mock.calls[0]![0];
      expect(where).toEqual({ id: { in: ["a", "b", "c"] } });
      expect(data).toEqual({ creditCost: 4, updatedAt: expect.any(Date) });
    });

    it("getModelStats turns grouped counts into lookup objects", async () => {
      prismaMock.modelMetadata.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6);
      prismaMock.modelMetadata.groupBy
        .mockResolvedValueOnce([{ providerSlug: "openrouter", _count: 10 }])
        .mockResolvedValueOnce([{ taskType: "text-generation", _count: 7 }])
        .mockResolvedValueOnce([{ tier: "PRO", _count: 4 }]);

      expect(await service.getModelStats()).toEqual({
        total: 10,
        active: 6,
        byProvider: { openrouter: 10 },
        byTaskType: { "text-generation": 7 },
        byTier: { PRO: 4 },
      });
    });
  });
});
