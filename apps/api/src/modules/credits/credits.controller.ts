import { Controller, Get, Post, Body, UseGuards, Param } from "@nestjs/common";
import {
  CreditService,
  BillingService,
  PaymentRegistryService,
} from "@creator-hub/billing";
import { PaymentGateway } from "@creator-hub/billing";
import { JwtAuthGuard, CurrentUser } from "@creator-hub/auth";
import { prisma } from "@creator-hub/database";

@Controller("credits")
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(
    private creditService: CreditService,
    private billingService: BillingService,
    private paymentRegistry: PaymentRegistryService,
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

  @Get("transactions")
  async getTransactions(@CurrentUser("id") userId: string) {
    const txns = await prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { tool: { select: { name: true, icon: true } } },
    });

    const txnIds = txns.map((tx) => tx.id);

    const logs = await prisma.aIRequestLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { model: true, provider: true, createdAt: true, toolId: true },
    });

    return txns.map((tx) => {
      const matchingLog = logs.find(
        (l) =>
          l.toolId === tx.toolId &&
          Math.abs(
            new Date(l.createdAt).getTime() - new Date(tx.createdAt).getTime(),
          ) < 30_000,
      );
      return {
        id: tx.id,
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        provider: tx.provider,
        balance: tx.balance,
        toolName: tx.tool?.name || tx.toolId || null,
        toolIcon: tx.tool?.icon || null,
        model: matchingLog?.model || null,
        createdAt: tx.createdAt,
      };
    });
  }

  @Post("subscribe")
  async subscribe(
    @CurrentUser("id") userId: string,
    @Body("planId") planId: string,
  ) {
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

  @Post("checkout")
  async checkout(
    @CurrentUser("id") userId: string,
    @Body("planId") planId: string,
    @Body("gateway") gateway?: string,
  ) {
    // Find plan (subscription plan used as credit pack)
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new Error("Plan not found");

    const credits = plan.creditsPerMonth || 0;
    const priceCents = plan.price || 0;
    const amount = (priceCents || 0) / 100; // convert to units expected by gateways

    const gatewayType =
      gateway === "PAYPAL"
        ? PaymentGateway.PAYPAL
        : PaymentGateway.MERCADO_PAGO;

    const paymentGateway = this.paymentRegistry.getGateway(gatewayType);

    const checkout = await paymentGateway.createCheckoutSession({
      userId,
      amount,
      currency: "USD",
      creditsToBuy: credits,
      description: `Purchase ${credits} credits - ${plan.name}`,
    });

    return {
      redirectUrl: checkout.paymentUrl,
      gatewayTxId: checkout.gatewayTxId,
      preferenceId: checkout.preferenceId,
    };
  }

  @Post("custom-checkout")
  async customCheckout(
    @CurrentUser("id") userId: string,
    @Body("amount") amount: number,
  ) {
    if (!amount || amount < 10) {
      throw new Error("Minimum amount is $10");
    }

    const credits = Math.floor(amount); // 1 dollar = 1 credit
    const gatewayType = PaymentGateway.MERCADO_PAGO;
    const paymentGateway = this.paymentRegistry.getGateway(gatewayType);

    const checkout = await paymentGateway.createCheckoutSession({
      userId,
      amount,
      currency: "USD",
      creditsToBuy: credits,
      description: `Purchase ${credits} credits`,
    });

    return {
      redirectUrl: checkout.paymentUrl,
      gatewayTxId: checkout.gatewayTxId,
      preferenceId: checkout.preferenceId,
    };
  }

  @Get("status/:gatewayTxId")
  async status(
    @CurrentUser("id") userId: string,
    @Param("gatewayTxId") gatewayTxId: string,
  ) {
    const txn = await prisma.creditTransaction.findFirst({
      where: { referenceId: gatewayTxId, userId },
    });
    if (!txn) return { status: "UNKNOWN" };

    const isPending = txn.description?.toLowerCase().includes("pending");
    return {
      status: isPending ? "PENDING" : "COMPLETED",
      transaction: {
        id: txn.id,
        amount: txn.amount,
        balance: txn.balance,
        createdAt: txn.createdAt,
      },
    };
  }
}
