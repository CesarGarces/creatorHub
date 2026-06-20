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
import type {
  PaymentSuccessEvent,
  PaymentFailedEvent,
  PaymentPendingEvent,
} from "@creator-hub/shared-types";
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

    const referenceId = verification.gatewayTxId;

    // Handle FAILED status - record the failed attempt, do NOT add credits
    if (verification.status === "FAILED") {
      this.logger.warn(`Payment ${referenceId} failed. Status: FAILED`);
      const failedUserId =
        raw?.external_reference || raw?.data?.external_reference;
      if (failedUserId) {
        try {
          const event: PaymentFailedEvent = {
            userId: failedUserId,
            gatewayTxId: referenceId,
            reason: "Payment rejected by gateway",
            gateway,
            timestamp: new Date(),
          };
          await this.eventPublisher.publish("payment:failed", event);
        } catch (err) {
          this.logger.warn("Failed to emit payment:failed event", err as any);
        }
      }
      return false;
    }

    // Handle PENDING status - fetch real status from API and act accordingly
    if (verification.status === "PENDING") {
      this.logger.log(
        `Payment ${referenceId} arrived as PENDING. Checking real status via API...`,
      );

      const mpClient = this.getMercadoPagoClient();
      if (mpClient && referenceId) {
        try {
          const paymentClient = new Payment(mpClient);
          const payment = await paymentClient.get({ id: referenceId });
          const paymentAny = payment as any;
          const mpStatus = (
            paymentAny?.status ||
            paymentAny?.collection_status ||
            ""
          )
            .toString()
            .toLowerCase();

          this.logger.log(
            `Payment ${referenceId} real API status: ${mpStatus}`,
          );

          // If actually approved, process it as SUCCESSFUL
          if (mpStatus === "approved" || mpStatus === "paid") {
            this.logger.log(
              `Payment ${referenceId} is actually ${mpStatus}. Processing as SUCCESSFUL.`,
            );
            // Fall through to SUCCESSFUL processing below
            verification = { ...verification, status: "SUCCESSFUL" };
          } else if (
            mpStatus === "rejected" ||
            mpStatus === "cancelled" ||
            mpStatus === "expired"
          ) {
            this.logger.warn(
              `Payment ${referenceId} is actually ${mpStatus}. Processing as FAILED.`,
            );
            const userId =
              paymentAny?.external_reference ||
              raw?.external_reference ||
              raw?.data?.external_reference;
            if (userId) {
              try {
                const event: PaymentFailedEvent = {
                  userId,
                  gatewayTxId: referenceId,
                  reason: `Payment status: ${mpStatus}`,
                  gateway,
                  timestamp: new Date(),
                };
                await this.eventPublisher.publish("payment:failed", event);
              } catch (err) {
                this.logger.warn(
                  "Failed to emit payment:failed event",
                  err as any,
                );
              }
            }
            return false;
          } else {
            // Still genuinely pending (in_process, pending, authorized, etc.)
            this.logger.log(
              `Payment ${referenceId} is genuinely ${mpStatus}. Emitting pending event.`,
            );
            const pendingUserId =
              paymentAny?.external_reference ||
              raw?.external_reference ||
              raw?.data?.external_reference;
            if (pendingUserId) {
              try {
                const event: PaymentPendingEvent = {
                  userId: pendingUserId,
                  gatewayTxId: referenceId,
                  reason: `Payment status: ${mpStatus}`,
                  gateway,
                  timestamp: new Date(),
                };
                await this.eventPublisher.publish("payment:pending", event);
              } catch (err) {
                this.logger.warn(
                  "Failed to emit payment:pending event",
                  err as any,
                );
              }
            }
            return true;
          }
        } catch (err) {
          this.logger.warn(
            `Failed to fetch payment ${referenceId} from API. Emitting pending event.`,
            err as any,
          );
          // API fetch failed - emit pending and hope for a payment.updated webhook
          const pendingUserId =
            raw?.external_reference || raw?.data?.external_reference;
          if (pendingUserId) {
            try {
              const event: PaymentPendingEvent = {
                userId: pendingUserId,
                gatewayTxId: referenceId,
                reason: "Payment in process - API unavailable",
                gateway,
                timestamp: new Date(),
              };
              await this.eventPublisher.publish("payment:pending", event);
            } catch (err2) {
              this.logger.warn(
                "Failed to emit payment:pending event",
                err2 as any,
              );
            }
          }
          return true;
        }
      }

      // No API client configured - emit pending and wait for next webhook
      const pendingUserId =
        raw?.external_reference || raw?.data?.external_reference;
      if (pendingUserId) {
        try {
          const event: PaymentPendingEvent = {
            userId: pendingUserId,
            gatewayTxId: referenceId,
            reason: "Payment in process - awaiting confirmation",
            gateway,
            timestamp: new Date(),
          };
          await this.eventPublisher.publish("payment:pending", event);
        } catch (err) {
          this.logger.warn("Failed to emit payment:pending event", err as any);
        }
      }
      return true;
    }

    // Handle SUCCESSFUL status - add credits
    if (verification.status !== "SUCCESSFUL") return false;

    // Idempotency + credit addition in a single transaction to prevent double-processing
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findFirst({
        where: { referenceId },
      });
      if (existing) {
        this.logger.log(`Payment already reconciled: ${referenceId}`);
        return { skipped: true };
      }

      // MercadoPago webhook only sends { action, data: { id } }
      // We need to fetch full payment details from the API
      let userId: string | undefined;
      let amountValue = 0;
      let creditsFromMetadata: number | null = null;
      let planSlugFromMetadata: string | null = null;

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

            // Read credits and plan from preference metadata (stored at checkout time)
            if (paymentAny.metadata?.credits) {
              creditsFromMetadata = Number(paymentAny.metadata.credits);
            }
            if (paymentAny.metadata?.plan_slug) {
              planSlugFromMetadata = String(paymentAny.metadata.plan_slug);
            }

            this.logger.log(
              `Fetched payment ${referenceId} from MP API: userId=${userId}, amount=${amountValue}, creditsFromMetadata=${creditsFromMetadata}, planSlug=${planSlugFromMetadata}`,
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
        return { skipped: false };
      }

      if (!amountValue || amountValue <= 0) {
        this.logger.warn(
          `Cannot reconcile payment ${referenceId}: invalid amount ${amountValue}`,
        );
        return { skipped: false };
      }

      // Prefer credits from metadata (exact amount from checkout time)
      // Fallback: calculate from plan (only works correctly if amount is in USD)
      let credits: number;
      if (creditsFromMetadata && creditsFromMetadata > 0) {
        credits = creditsFromMetadata;
        this.logger.log(
          `Using credits from metadata for ${referenceId}: ${credits}`,
        );
      } else {
        // Fallback: look up PAY_AS_YOU_GO plan for credit conversion rate
        const paygPlan = await tx.creditPlan.findUnique({
          where: { slug: "PAY_AS_YOU_GO" },
        });

        // NOTE: amountValue from MP may be in ARS (seller currency), not USD
        // This fallback is only accurate if amount is in USD
        credits = paygPlan
          ? Math.floor(
              (amountValue / paygPlan.usdAmount) * paygPlan.creditsGiven,
            )
          : Math.floor(amountValue * 100);

        this.logger.warn(
          `Credits from metadata missing for ${referenceId}, fell back to calculation: ${credits} (amount=${amountValue})`,
        );
      }

      if (credits <= 0) {
        this.logger.warn(`Calculated 0 credits for payment ${referenceId}`);
        return { skipped: false };
      }

      this.logger.log(
        `Reconciling payment ${referenceId}: userId=${userId}, amount=${amountValue}, credits=${credits}`,
      );

      // Add credits and create transaction atomically
      const field = "purchasedCredits";
      const userUpdateData: any = { [field]: { increment: credits } };

      // Update user's plan based on the credit plan they purchased
      if (planSlugFromMetadata) {
        const planMap: Record<string, string> = {
          PAY_AS_YOU_GO: "PAY_AS_YOU_GO",
          STARTER: "STARTER",
          PRO: "PRO",
        };
        const newUserPlan = planMap[planSlugFromMetadata];
        if (newUserPlan) {
          userUpdateData.plan = newUserPlan;
          this.logger.log(
            `Updating user ${userId} plan to ${newUserPlan} (from plan_slug=${planSlugFromMetadata})`,
          );
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
      });

      const updated = await tx.user.findUnique({ where: { id: userId } });
      const newBalance =
        (updated?.currentCredits || 0) + (updated?.purchasedCredits || 0);

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: credits,
          type: "PURCHASE",
          description: `Payment ${gateway} - ${referenceId}`,
          balance: newBalance,
          provider: gateway,
          referenceId,
        },
      });

      return { skipped: false, userId, credits, referenceId };
    });

    if (result.skipped) return true;
    if (!result.userId || !result.credits) return false;

    // Emit real-time notification
    try {
      const balanceAfter = await this.creditService.getBalance(result.userId);
      const event: PaymentSuccessEvent = {
        userId: result.userId,
        gatewayTxId: result.referenceId,
        amount: result.credits,
        balance: balanceAfter || 0,
        gateway,
        timestamp: new Date(),
      };
      await this.eventPublisher.publish("payment:success", event);
    } catch (err) {
      this.logger.warn("Failed to emit payment success event", err as any);
    }
    return true;
  }
}
