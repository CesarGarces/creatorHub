import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "@creator-hub/auth";
import { prisma } from "@creator-hub/database";

@Controller("ai")
@UseGuards(JwtAuthGuard)
export class AIController {
  @Get("providers")
  async getProviders() {
    const providers = await prisma.provider.findMany({
      where: { isActive: true },
      orderBy: [{ tier: "asc" }, { costPerCredit: "asc" }, { name: "asc" }],
      include: {
        modes: {
          include: { mode: true },
        },
      },
    });

    return providers.map((p) => ({
      id: p.slug,
      name: p.name,
      displayName: p.name,
      tier: p.tier === "PRO" ? "pro" : "free",
      costPerCredit: p.costPerCredit,
      model: p.model,
      supportedTasks: p.supportedTasks,
      modes: p.modes.filter((pm) => pm.mode.isActive).map((pm) => pm.mode.slug),
    }));
  }
}
