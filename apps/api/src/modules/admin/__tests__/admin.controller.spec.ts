import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import { AdminController } from "../admin.controller";
import { AdminGuard } from "../admin.guard";

describe("AdminController", () => {
  const adminService = {
    findAllProviders: vi.fn(),
    updateUser: vi.fn(),
    deactivateUser: vi.fn(),
    activateUser: vi.fn(),
    findAllModels: vi.fn(),
    bulkUpdateModels: vi.fn(),
    setToolModes: vi.fn(),
    setProviderModes: vi.fn(),
  };
  const backupService = {
    listBackups: vi.fn(),
    createBackup: vi.fn(),
    deleteBackup: vi.fn(),
    getBackupDownloadUrl: vi.fn(),
  };
  const modelSyncService = { sync: vi.fn() };
  const controller = new AdminController(
    adminService as never,
    backupService as never,
    modelSyncService as never,
  );
  const actor = { id: "admin-1", role: "ADMIN" };

  beforeEach(() => vi.clearAllMocks());

  it("is protected by both the JWT guard and the admin guard", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController);
    expect(guards).toEqual([JwtAuthGuard, AdminGuard]);
  });

  it("passes the acting admin's id to user mutations", async () => {
    await controller.updateUser("u1", { name: "X" }, actor);
    await controller.deactivateUser("u1", actor);
    await controller.activateUser("u1", actor);

    expect(adminService.updateUser).toHaveBeenCalledWith(
      "u1",
      { name: "X" },
      "admin-1",
    );
    expect(adminService.deactivateUser).toHaveBeenCalledWith("u1", "admin-1");
    expect(adminService.activateUser).toHaveBeenCalledWith("u1", "admin-1");
  });

  it("splits comma-separated model tags", async () => {
    await controller.getModels(
      2,
      50,
      "openrouter",
      undefined,
      "PRO",
      true,
      "llama",
      "fast,cheap",
      "newest",
    );

    expect(adminService.findAllModels).toHaveBeenCalledWith({
      page: 2,
      limit: 50,
      providerSlug: "openrouter",
      taskType: undefined,
      tier: "PRO",
      isActive: true,
      search: "llama",
      tags: ["fast", "cheap"],
      sort: "newest",
    });
  });

  it("only forwards whitelisted fields in bulk model updates", async () => {
    await controller.bulkUpdateModels({
      ids: ["m1"],
      isActive: false,
      ...({ providerSlug: "injected" } as object),
    } as never);

    expect(adminService.bulkUpdateModels).toHaveBeenCalledWith(["m1"], {
      isActive: false,
      creditCost: undefined,
      profitMargin: undefined,
      tier: undefined,
      taskType: undefined,
    });
  });

  it("treats a missing modeIds body as an empty list", async () => {
    await controller.setToolModes("t1", undefined as never);
    await controller.setProviderModes("p1", undefined as never);

    expect(adminService.setToolModes).toHaveBeenCalledWith("t1", []);
    expect(adminService.setProviderModes).toHaveBeenCalledWith("p1", []);
  });

  it("wraps the backup download URL in an object", async () => {
    backupService.getBackupDownloadUrl.mockResolvedValue("https://signed");

    expect(await controller.downloadBackup("b1")).toEqual({
      url: "https://signed",
    });
  });

  it("triggers a model sync", async () => {
    modelSyncService.sync.mockResolvedValue({ synced: 3 });
    expect(await controller.syncModels()).toEqual({ synced: 3 });
  });
});
