import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";

@Injectable()
export class BillingService {
  private logger = new Logger("BillingService");

  async getPlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
    });
  }

  async subscribe(userId: string, planId: string) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error("Plan not found");

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        status: "ACTIVE",
      },
    });

    await prisma.creditBalance.upsert({
      where: { userId },
      update: {
        balance: { increment: plan.creditsPerMonth },
        lifetime: { increment: plan.creditsPerMonth },
      },
      create: {
        userId,
        balance: plan.creditsPerMonth,
        lifetime: plan.creditsPerMonth,
      },
    });

    return subscription;
  }

  async cancelSubscription(userId: string) {
    return prisma.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { cancelAtPeriodEnd: true },
    });
  }
}
