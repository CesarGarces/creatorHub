import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";

@Injectable()
export class CreditService {
  private logger = new Logger("CreditService");

  constructor(
    @InjectQueue("credits") private creditsQueue: Queue,
    private eventEmitter: EventEmitter2,
  ) {}

  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { freeCredits: true, purchasedCredits: true },
    });

    if (!user) return 0;
    return user.freeCredits + user.purchasedCredits;
  }

  async deduct(
    userId: string,
    amount: number,
    toolId?: string,
    description?: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return false;
    }

    const totalCredits = user.freeCredits + user.purchasedCredits;
    if (totalCredits < amount) {
      await this.creditsQueue.add("credit-depleted", {
        userId,
        balance: totalCredits,
      });

      this.eventEmitter.emit("marketing.credit_depleted", {
        userId,
        timestamp: new Date(),
      });

      return false;
    }

    let freeCreditsDeduction = 0;
    let purchasedCreditsDeduction = 0;

    if (user.freeCredits >= amount) {
      freeCreditsDeduction = amount;
    } else {
      freeCreditsDeduction = user.freeCredits;
      purchasedCreditsDeduction = amount - user.freeCredits;
    }

    let validToolId: string | null = null;
    if (toolId) {
      const tool = await prisma.tool.findUnique({ where: { id: toolId } });
      if (tool) validToolId = tool.id;
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          freeCredits: { decrement: freeCreditsDeduction },
          purchasedCredits: { decrement: purchasedCreditsDeduction },
        },
      });

      const updated = await tx.user.findUnique({ where: { id: userId } });
      const newBalance =
        (updated?.freeCredits || 0) + (updated?.purchasedCredits || 0);

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: "USAGE",
          description: description || `Tool usage: ${toolId}`,
          toolId: validToolId,
          balance: newBalance,
        },
      });
    });

    return true;
  }

  async addCredits(
    userId: string,
    amount: number,
    description: string,
    type: "PURCHASE" | "BONUS" | "SUBSCRIPTION" | "PROMOTION" = "BONUS",
    options?: { provider?: string; referenceId?: string },
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const field = type === "PURCHASE" ? "purchasedCredits" : "freeCredits";

      await tx.user.update({
        where: { id: userId },
        data: {
          [field]: { increment: amount },
        },
      });

      const updated = await tx.user.findUnique({ where: { id: userId } });
      const newBalance =
        (updated?.freeCredits || 0) + (updated?.purchasedCredits || 0);

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
          balance: newBalance,
          ...(options?.provider ? { provider: options.provider } : {}),
          ...(options?.referenceId ? { referenceId: options.referenceId } : {}),
        },
      });
    });
  }

  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }
}
