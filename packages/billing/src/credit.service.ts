import { Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import * as Sentry from "@sentry/node";

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
      select: { currentCredits: true },
    });

    if (!user) return 0;
    return user.currentCredits;
  }

  async deduct(
    userId: string,
    amount: number,
    toolId?: string,
    description?: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      this.logger.warn("Credit deduction failed: user not found", {
        userId,
        amount,
        toolId,
      });
      Sentry.addBreadcrumb({
        type: "default",
        category: "billing.credit",
        message: `Credit deduction failed: user not found`,
        level: "warning",
        data: { userId, amount, toolId },
      });
      return false;
    }

    if (user.currentCredits < amount) {
      this.logger.warn("Insufficient credits", {
        userId,
        currentCredits: user.currentCredits,
        requested: amount,
        toolId,
      });
      Sentry.addBreadcrumb({
        type: "default",
        category: "billing.credit",
        message: `Insufficient credits: ${user.currentCredits} < ${amount}`,
        level: "warning",
        data: {
          userId,
          currentCredits: user.currentCredits,
          requested: amount,
          toolId,
        },
      });

      await this.creditsQueue.add("credit-depleted", {
        userId,
        balance: user.currentCredits,
      });

      this.eventEmitter.emit("marketing.credit_depleted", {
        userId,
        timestamp: new Date(),
      });

      return false;
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
          currentCredits: { decrement: amount },
        },
      });

      const updated = await tx.user.findUnique({ where: { id: userId } });
      const newBalance = updated?.currentCredits || 0;

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

      // Breadcrumb: Credit deduction success
      Sentry.addBreadcrumb({
        type: "default",
        category: "billing.credit",
        message: `Deducted ${amount} credits for user ${userId}`,
        level: "info",
        data: {
          userId,
          amount,
          newBalance,
          toolId: validToolId,
          description,
        },
      });

      this.logger.info(`Deducted ${amount} credits`, {
        userId,
        amount,
        newBalance,
        toolId: validToolId,
        description,
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
      const updateData: any = {
        currentCredits: { increment: amount },
      };

      if (type === "PURCHASE") {
        updateData.purchasedCredits = { increment: amount };
      }

      await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      const updated = await tx.user.findUnique({ where: { id: userId } });
      const newBalance = updated?.currentCredits || 0;

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

      // Breadcrumb: Credits added
      Sentry.addBreadcrumb({
        type: "default",
        category: "billing.credit",
        message: `Added ${amount} credits (${type}) for user ${userId}`,
        level: "info",
        data: {
          userId,
          amount,
          type,
          newBalance,
          provider: options?.provider,
          referenceId: options?.referenceId,
          description,
        },
      });
    });
  }

  async hasEnoughCredits(userId: string, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }
}
