import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";

@Injectable()
export class ToolFavoritesService {
  async getFavoriteIds(userId: string): Promise<string[]> {
    const favorites = await prisma.toolFavorite.findMany({
      where: { userId },
      select: { toolId: true },
      orderBy: { sortOrder: "asc" },
    });
    return favorites.map((f) => f.toolId);
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
      const maxOrder = await prisma.toolFavorite.aggregate({
        where: { userId },
        _max: { sortOrder: true },
      });

      await prisma.toolFavorite.create({
        data: {
          userId,
          toolId,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });
      return { favorited: true };
    }
  }

  async reorderFavorites(
    userId: string,
    orderedIds: string[],
  ): Promise<{ success: boolean }> {
    const updates = orderedIds.map((toolId, index) =>
      prisma.toolFavorite.updateMany({
        where: { userId, toolId },
        data: { sortOrder: index },
      }),
    );

    await prisma.$transaction(updates);
    return { success: true };
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
