import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";

@Injectable()
export class AnalyticsService {
  async getToolUsage(toolId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const usage = await prisma.usageLog.groupBy({
      by: ["createdAt"],
      where: {
        toolId,
        createdAt: { gte: since },
      },
      _count: { id: true },
      _sum: { credits: true },
    });

    return usage;
  }

  async getUserStats(userId: string) {
    const [totalUsage, totalCredits, toolsUsed] = await Promise.all([
      prisma.usageLog.count({ where: { userId } }),
      prisma.creditTransaction.aggregate({
        where: { userId, type: "USAGE" },
        _sum: { amount: true },
      }),
      prisma.usageLog.groupBy({
        by: ["toolId"],
        where: { userId },
        _count: { id: true },
      }),
    ]);

    return { totalUsage, totalCreditsSpent: Math.abs(totalCredits._sum.amount || 0), toolsUsed: toolsUsed.length };
  }

  async getDashboardStats() {
    const [totalUsers, totalUsage, activeTools, totalRevenue] = await Promise.all([
      prisma.user.count(),
      prisma.usageLog.count(),
      prisma.tool.count({ where: { status: "active" } }),
      prisma.creditTransaction.aggregate({
        where: { type: "PURCHASE" },
        _sum: { amount: true },
      }),
    ]);

    return { totalUsers, totalUsage, activeTools, totalRevenue: totalRevenue._sum.amount || 0 };
  }
}
