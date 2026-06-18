import { Injectable, Logger, Inject } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { CreditService } from "../credit.service";
import {
  PaymentGateway,
  WebhookVerificationResult,
} from "../interfaces/payment-gateway.interface";
import {
  DomainEventPublisher,
  DOMAIN_EVENT_PUBLISHER,
} from "@creator-hub/domain-events";
import type { PaymentSuccessEvent } from "@creator-hub/shared-types";

@Injectable()
export class CreditBillingService {
  private readonly logger = new Logger(CreditBillingService.name);

  constructor(
    private readonly creditService: CreditService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async reconcilePayment(
    gateway: PaymentGateway,
    verification: WebhookVerificationResult,
    raw: any,
  ) {
    if (!verification.isValid) return false;
    if (verification.status !== "SUCCESSFUL") return false;

    const referenceId = verification.gatewayTxId;

    // Idempotency: if we've already recorded a purchase with this reference, ignore
    const existing = await prisma.creditTransaction.findFirst({
      where: { referenceId },
    });
    if (existing) {
      this.logger.log(`Payment already reconciled: ${referenceId}`);
      return true;
    }

    const userId =
      raw?.external_reference ||
      raw?.data?.external_reference ||
      raw?.resource?.external_reference;
    const amountValue =
      raw?.amount ||
      raw?.data?.amount ||
      raw?.resource?.amount ||
      raw?.transaction_amount ||
      0;
    const credits = Math.floor(amountValue || 0);

    if (!userId) {
      this.logger.warn(
        "Cannot reconcile payment without external_reference (userId)",
      );
      return false;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Apply credits using CreditService which itself uses transactions for safety
        await this.creditService.addCredits(
          userId,
          credits,
          `Purchase via ${gateway}`,
          "PURCHASE",
        );

        const balance = await this.creditService.getBalance(userId);

        await tx.creditTransaction.create({
          data: {
            userId,
            amount: credits,
            type: "PURCHASE",
            description: `Payment ${gateway}`,
            provider: gateway,
            referenceId,
            balance: balance || 0,
          },
        });
      });

      // Emit real-time notification to the user via domain event (Redis pub/sub)
      try {
        if (userId) {
          const balanceAfter = await this.creditService.getBalance(userId);
          const event: PaymentSuccessEvent = {
            userId,
            gatewayTxId: referenceId,
            amount: credits,
            balance: balanceAfter || 0,
            gateway,
            timestamp: new Date(),
          };
          await this.eventPublisher.publish("payment:success", event);
        }
      } catch (err) {
        this.logger.warn("Failed to emit payment success event", err as any);
      }
      return true;
    } catch (err) {
      this.logger.error("Error reconciling payment", err as any);
      return false;
    }
  }
}
