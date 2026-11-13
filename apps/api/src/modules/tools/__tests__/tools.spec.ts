import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import { ToolRegistry } from "@creator-hub/tool-sdk";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { toolManifest } from "../../../__tests__/helpers/tool-manifest";
import { ToolsController } from "../tools.controller";
import { ToolFavoritesService } from "../tool-favorites.service";
import { ToolFavoritesController } from "../tool-favorites.controller";

describe("ToolsController", () => {
  let registry: ToolRegistry;
  let controller: ToolsController;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    registry = new ToolRegistry();
    registry.register(toolManifest({ id: "thumb", name: "Thumbs" }));
    registry.register(
      toolManifest({ id: "vid", name: "Videos", status: "beta" }),
    );
    registry.register(
      toolManifest({ id: "off", name: "Disabled", status: "inactive" }),
    );
    controller = new ToolsController(registry);
  });

  it("requires authentication", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ToolsController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  it("lists active and beta tools only", async () => {
    const tools = await controller.listTools();
    expect(tools.map((t) => t.id)).toEqual(["thumb", "vid"]);
  });

  it("returns a tool by id", async () => {
    expect((await controller.getTool("vid"))?.name).toBe("Videos");
    expect(await controller.getTool("missing")).toBeUndefined();
  });

  it("lists frontend routes tagged with their tool", async () => {
    const routes = await controller.getRoutes();

    expect(routes).toContainEqual(
      expect.objectContaining({
        path: "/tools/thumb",
        toolId: "thumb",
        toolName: "Thumbs",
      }),
    );
    expect(routes).toHaveLength(3);
  });
});

describe("ToolFavoritesService", () => {
  const service = new ToolFavoritesService();

  beforeEach(() => resetPrismaMock());

  it("returns favorite tool ids in the user's order", async () => {
    prismaMock.toolFavorite.findMany.mockResolvedValue([
      { toolId: "b" },
      { toolId: "a" },
    ]);

    expect(await service.getFavoriteIds("u1")).toEqual(["b", "a"]);
    expect(prismaMock.toolFavorite.findMany).toHaveBeenCalledWith({
      where: { userId: "u1" },
      select: { toolId: true },
      orderBy: { sortOrder: "asc" },
    });
  });

  it("removes an existing favorite", async () => {
    prismaMock.toolFavorite.findUnique.mockResolvedValue({ id: "fav-1" });

    expect(await service.toggleFavorite("u1", "thumb")).toEqual({
      favorited: false,
    });
    expect(prismaMock.toolFavorite.findUnique).toHaveBeenCalledWith({
      where: { userId_toolId: { userId: "u1", toolId: "thumb" } },
    });
    expect(prismaMock.toolFavorite.delete).toHaveBeenCalledWith({
      where: { id: "fav-1" },
    });
    expect(prismaMock.toolFavorite.create).not.toHaveBeenCalled();
  });

  it("appends a new favorite at the end of the list", async () => {
    prismaMock.toolFavorite.findUnique.mockResolvedValue(null);
    prismaMock.toolFavorite.aggregate.mockResolvedValue({
      _max: { sortOrder: 4 },
    });

    expect(await service.toggleFavorite("u1", "thumb")).toEqual({
      favorited: true,
    });
    expect(prismaMock.toolFavorite.create).toHaveBeenCalledWith({
      data: { userId: "u1", toolId: "thumb", sortOrder: 5 },
    });
  });

  it("gives the first favorite sort order 0", async () => {
    prismaMock.toolFavorite.findUnique.mockResolvedValue(null);
    prismaMock.toolFavorite.aggregate.mockResolvedValue({
      _max: { sortOrder: null },
    });

    await service.toggleFavorite("u1", "thumb");

    expect(
      prismaMock.toolFavorite.create.mock.calls[0]![0].data.sortOrder,
    ).toBe(0);
  });

  it("reorders favorites atomically, scoped to the user", async () => {
    prismaMock.toolFavorite.updateMany.mockResolvedValue({ count: 1 });

    expect(await service.reorderFavorites("u1", ["c", "a", "b"])).toEqual({
      success: true,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(
      prismaMock.toolFavorite.updateMany.mock.calls.map((c) => c[0]),
    ).toEqual([
      { where: { userId: "u1", toolId: "c" }, data: { sortOrder: 0 } },
      { where: { userId: "u1", toolId: "a" }, data: { sortOrder: 1 } },
      { where: { userId: "u1", toolId: "b" }, data: { sortOrder: 2 } },
    ]);
  });

  it("reports favorite counts per tool", async () => {
    prismaMock.toolFavorite.groupBy.mockResolvedValue([
      { toolId: "thumb", _count: { id: 8 } },
      { toolId: "vid", _count: { id: 2 } },
    ]);

    expect(await service.getFavoriteStats()).toEqual([
      { toolId: "thumb", count: 8 },
      { toolId: "vid", count: 2 },
    ]);
  });
});

describe("ToolFavoritesController", () => {
  const favorites = {
    getFavoriteIds: vi.fn(),
    toggleFavorite: vi.fn(),
    reorderFavorites: vi.fn(),
  };
  const controller = new ToolFavoritesController(favorites as never);
  const req = { user: { id: "u1" } };

  it("requires authentication", () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ToolFavoritesController),
    ).toEqual([JwtAuthGuard]);
  });

  it("uses the authenticated user for every operation", async () => {
    await controller.getFavorites(req);
    await controller.toggleFavorite(req, "thumb");
    await controller.reorderFavorites(req, { orderedIds: ["thumb"] });

    expect(favorites.getFavoriteIds).toHaveBeenCalledWith("u1");
    expect(favorites.toggleFavorite).toHaveBeenCalledWith("u1", "thumb");
    expect(favorites.reorderFavorites).toHaveBeenCalledWith("u1", ["thumb"]);
  });
});
