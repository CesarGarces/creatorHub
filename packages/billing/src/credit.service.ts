import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";

@Injectable()
export class CreditService {
  private logger = new Logger("CreditService");

  constructor(@InjectQueue("credits") private creditsQueue: Queue) {}

  async getBalance(userId: string): Promise<number> {
    const balance = await prisma.creditBalance.findUnique({
      where: { userId },
    });
    return balance?.balance || 0;
  }

  async deduct(userId: string, amount: number, toolId?: string, description?: string): Promise<boolean> {
    const balance = await prisma.creditBalance.findUnique({
      where: { userId },
    });

    if (!balance || balance.balance < amount) {
      await this.creditsQueue.add("credit-depleted", { userId, balance: balance?.balance || 0 });
      return false;
    }

    let validToolId: string | null = null;
    if (toolId) {
      const tool = await prisma.tool.findUnique({ where: { id: toolId } });
      if (tool) validToolId = tool.id;
    }

    await prisma.$transaction(async (tx) => {
      await tx.creditBalance.update({
        where: { userId },
        data: { balance: { decrement: amount } },
      });

      const updated = await tx.creditBalance.findUnique({ where: { userId } });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: "USAGE",
          description: description || `Tool usage: ${toolId}`,
          toolId: validToolId,
          balance: updated!.balance,
        },
      });
    });

    return true;
  }

  async addCredits(userId: string, amount: number, description: string, type: "PURCHASE" | "BONUS" | "SUBSCRIPTION" | "PROMOTION" = "BONUS") {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.creditBalance.update({
        where: { userId },
        data: {
          balance: { increment: amount },
          lifetime: { increment: amount },
        },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type,
          description,
          balance: updated.balance,
        },
      });
    });
  }

  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }
}
