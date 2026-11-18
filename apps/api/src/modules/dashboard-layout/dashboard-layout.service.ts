import { Injectable } from "@nestjs/common";
import { prisma, type Prisma } from "@creator-hub/database";
import {
  normalizeDashboardWidgets,
  type DashboardLayout,
  type DashboardWidgetState,
} from "@creator-hub/shared-types";

/**
 * The user's dashboard widgets: order and visibility (ARCHITECTURE.md §2f).
 *
 * One `DashboardLayout` row per user, created on the first change. Every
 * read and write goes through `normalizeDashboardWidgets()`, so the answer
 * always lists every known widget exactly once — widgets added after the
 * layout was saved show up with their default visibility.
 */
@Injectable()
export class DashboardLayoutService {
  async getLayout(userId: string): Promise<DashboardLayout> {
    const row = await prisma.dashboardLayout.findUnique({
      where: { userId },
      select: { widgets: true, updatedAt: true },
    });
    if (!row) return this.defaultLayout();
    return {
      widgets: normalizeDashboardWidgets(row.widgets),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveLayout(
    userId: string,
    widgets: DashboardWidgetState[],
  ): Promise<DashboardLayout> {
    const normalized = normalizeDashboardWidgets(widgets);
    // Plain `{ id, visible }` objects (no DTO instances) in a complete list.
    const stored: Prisma.InputJsonArray = normalized.map(({ id, visible }) => ({
      id,
      visible,
    }));
    const row = await prisma.dashboardLayout.upsert({
      where: { userId },
      create: { userId, widgets: stored },
      update: { widgets: stored },
      select: { updatedAt: true },
    });
    return { widgets: normalized, updatedAt: row.updatedAt.toISOString() };
  }

  /** Back to the default dashboard (the row is removed). */
  async resetLayout(userId: string): Promise<DashboardLayout> {
    await prisma.dashboardLayout.deleteMany({ where: { userId } });
    return this.defaultLayout();
  }

  private defaultLayout(): DashboardLayout {
    return { widgets: normalizeDashboardWidgets(undefined), updatedAt: null };
  }
}
