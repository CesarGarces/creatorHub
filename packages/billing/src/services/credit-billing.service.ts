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
import { MercadoPagoConfig, Payment } from "mercadopago";

@Injectable()
export class CreditBillingService {
  private readonly logger = new Logger(CreditBillingService.name);

  constructor(
    private readonly creditService: CreditService,
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  private getMercadoPagoClient() {
    const accessToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return null;
    return new MercadoPagoConfig({ accessToken });
  }

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

    // MercadoPago webhook only sends { action, data: { id } }
    // We need to fetch full payment details from the API
    let userId: string | undefined;
    let amountValue = 0;

    // Try to get from raw body first (in case some gateways send it directly)
    userId =
      raw?.external_reference ||
      raw?.data?.external_reference ||
      raw?.resource?.external_reference;
    amountValue =
      raw?.transaction_amount ||
      raw?.amount ||
      raw?.data?.amount ||
      raw?.resource?.amount ||
      0;

    // If not found in raw body, fetch from MercadoPago API
    if (!userId || !amountValue) {
      const mpClient = this.getMercadoPagoClient();
      if (mpClient && referenceId) {
        try {
          const paymentClient = new Payment(mpClient);
          const payment = await paymentClient.get({ id: referenceId });
          const paymentAny = payment as any;

          if (!userId) {
            userId = paymentAny.external_reference;
          }
          if (!amountValue) {
            amountValue = paymentAny.transaction_amount || 0;
          }

          this.logger.log(
            `Fetched payment ${referenceId} from MP API: userId=${userId}, amount=${amountValue}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to fetch payment ${referenceId} from MP API`,
            err as any,
          );
        }
      }
    }

    if (!userId) {
      this.logger.warn(
        `Cannot reconcile payment ${referenceId}: userId not found`,
      );
      return false;
    }

    if (!amountValue || amountValue <= 0) {
      this.logger.warn(
        `Cannot reconcile payment ${referenceId}: invalid amount ${amountValue}`,
      );
      return false;
    }

    // Look up PAY_AS_YOU_GO plan for credit conversion rate
    const paygPlan = await prisma.creditPlan.findUnique({
      where: { slug: "PAY_AS_YOU_GO" },
    });

    // Calculate credits based on the plan's conversion rate
    // amountValue from MP is in the currency of the preference (USD in our case)
    const credits = paygPlan
      ? Math.floor((amountValue / paygPlan.usdAmount) * paygPlan.creditsGiven)
      : Math.floor(amountValue * 100);

    if (credits <= 0) {
      this.logger.warn(`Calculated 0 credits for payment ${referenceId}`);
      return false;
    }

    this.logger.log(
      `Reconciling payment ${referenceId}: userId=${userId}, amount=${amountValue}, credits=${credits}`,
    );

    try {
      await prisma.$transaction(async (tx) => {
        await this.creditService.addCredits(
          userId!,
          credits,
          `Purchase via ${gateway}`,
          "PURCHASE",
        );

        const balance = await this.creditService.getBalance(userId!);

        await tx.creditTransaction.create({
          data: {
            userId: userId!,
            amount: credits,
            type: "PURCHASE",
            description: `Payment ${gateway}`,
            provider: gateway,
            referenceId,
            balance: balance || 0,
          },
        });
      });

      // Emit real-time notification
      try {
        const balanceAfter = await this.creditService.getBalance(userId!);
        const event: PaymentSuccessEvent = {
          userId: userId!,
          gatewayTxId: referenceId,
          amount: credits,
          balance: balanceAfter || 0,
          gateway,
          timestamp: new Date(),
        };
        await this.eventPublisher.publish("payment:success", event);
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
