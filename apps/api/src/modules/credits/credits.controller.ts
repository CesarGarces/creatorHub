import { Controller, Get, Post, Body, UseGuards } from "@nestjs/common";
import { CreditService, BillingService } from "@creator-hub/billing";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { prisma } from "@creator-hub/database";

@Controller("credits")
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(
    private creditService: CreditService,
    private billingService: BillingService
  ) {}

  @Get("balance")
  async getBalance(@CurrentUser("id") userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        freeCredits: true,
        purchasedCredits: true,
        plan: true,
      },
    });

    return {
      balance: (user?.freeCredits || 0) + (user?.purchasedCredits || 0),
      freeCredits: user?.freeCredits || 0,
      purchasedCredits: user?.purchasedCredits || 0,
      plan: user?.plan || "FREE",
    };
  }

  @Get("plans")
  async getPlans() {
    return this.billingService.getPlans();
  }

  @Post("subscribe")
  async subscribe(@CurrentUser("id") userId: string, @Body("planId") planId: string) {
    return this.billingService.subscribe(userId, planId);
  }

  @Get("marketing-events")
  async getMarketingEvents(@CurrentUser("id") userId: string) {
    const events = await prisma.marketingEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return events.map((e) => ({
      id: e.id,
      type: e.type,
      credits: e.credits,
      metadata: e.metadata as Record<string, unknown> | null,
      createdAt: e.createdAt,
    }));
  }
}
