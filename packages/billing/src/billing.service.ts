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
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
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

    const userPlan =
      planId === "free"
        ? "FREE"
        : planId === "pro"
          ? "PREMIUM"
          : "PAY_AS_YOU_GO";

    await prisma.user.update({
      where: { id: userId },
      data: {
        plan: userPlan as any,
        purchasedCredits: { increment: plan.creditsPerMonth },
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
