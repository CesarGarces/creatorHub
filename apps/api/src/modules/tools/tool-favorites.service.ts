import { Injectable } from "@nestjs/common";
import { prisma, type Tool } from "@creator-hub/database";

@Injectable()
export class ToolFavoritesService {
  async getFavorites(userId: string): Promise<Tool[]> {
    const favorites = await prisma.toolFavorite.findMany({
      where: { userId },
      include: { tool: true },
      orderBy: { createdAt: "desc" },
    });
    return favorites.map((f) => f.tool);
  }

  async getFavoriteIds(userId: string): Promise<string[]> {
    const favorites = await prisma.toolFavorite.findMany({
      where: { userId },
      select: { toolId: true },
    });
    return favorites.map((f) => f.toolId);
  }

  async addFavorite(
    userId: string,
    toolId: string,
  ): Promise<{ success: boolean }> {
    await prisma.toolFavorite.upsert({
      where: { userId_toolId: { userId, toolId } },
      create: { userId, toolId },
      update: {},
    });
    return { success: true };
  }

  async removeFavorite(
    userId: string,
    toolId: string,
  ): Promise<{ success: boolean }> {
    await prisma.toolFavorite.deleteMany({
      where: { userId, toolId },
    });
    return { success: true };
  }

  async toggleFavorite(
    userId: string,
    toolId: string,
  ): Promise<{ favorited: boolean }> {
    const existing = await prisma.toolFavorite.findUnique({
      where: { userId_toolId: { userId, toolId } },
    });

    if (existing) {
      await prisma.toolFavorite.delete({
        where: { id: existing.id },
      });
      return { favorited: false };
    } else {
      await prisma.toolFavorite.create({
        data: { userId, toolId },
      });
      return { favorited: true };
    }
  }

  async getFavoriteStats(): Promise<{ toolId: string; count: number }[]> {
    const stats = await prisma.toolFavorite.groupBy({
      by: ["toolId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    return stats.map((s) => ({
      toolId: s.toolId,
      count: s._count.id,
    }));
  }
}
