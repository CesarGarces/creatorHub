import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { EmailService } from "@creator-hub/email";
import {
  DomainEventSubscriber,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import type {
  PaymentSuccessEvent,
  PaymentFailedEvent,
} from "@creator-hub/shared-types";

const PAYMENT_SUCCESS_CHANNEL = "payment:success";
const PAYMENT_FAILED_CHANNEL = "payment:failed";

const ACTIVE_TOOLS_LIST = [
  "Thumbnail Generator",
  "Video Generator",
  "Post to X",
  "X Trend Research",
  "Content Translator",
];

@Injectable()
export class PaymentEmailListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private logger = new Logger("PaymentEmailListenerService");

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private eventSubscriber: DomainEventSubscriber,
    private emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.eventSubscriber.subscribe<PaymentSuccessEvent>(
      PAYMENT_SUCCESS_CHANNEL,
      this.handlePaymentSuccess.bind(this),
    );
    await this.eventSubscriber.subscribe<PaymentFailedEvent>(
      PAYMENT_FAILED_CHANNEL,
      this.handlePaymentFailed.bind(this),
    );

    this.logger.log(
      "PaymentEmailListenerService subscribed to payment events (success, failed)",
    );
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(PAYMENT_SUCCESS_CHANNEL);
    await this.eventSubscriber.unsubscribe(PAYMENT_FAILED_CHANNEL);
    this.logger.log(
      "PaymentEmailListenerService unsubscribed from payment events",
    );
  }

  private async handlePaymentSuccess(event: PaymentSuccessEvent) {
    this.logger.log("Payment success received, sending confirmation email", {
      userId: event.userId,
      gatewayTxId: event.gatewayTxId,
      amount: event.amount,
    });

    try {
      const user = await prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        this.logger.warn(
          `Cannot send purchase success email: user ${event.userId} has no email`,
        );
        return;
      }

      await this.emailService.sendPurchaseSuccessEmail(user.email, {
        userName: user.name || undefined,
        credits: event.amount,
        balance: event.balance,
        activeTools: ACTIVE_TOOLS_LIST,
      });

      this.logger.log(
        `Purchase success email sent to ${user.email} for ${event.amount} credits`,
      );
    } catch (error) {
      this.logger.error("Failed to send purchase success email", {
        error: (error as Error).message,
        userId: event.userId,
      });
    }
  }

  private async handlePaymentFailed(event: PaymentFailedEvent) {
    this.logger.log("Payment failed received, sending failure email", {
      userId: event.userId,
      gatewayTxId: event.gatewayTxId,
      reason: event.reason,
    });

    try {
      const user = await prisma.user.findUnique({
        where: { id: event.userId },
        select: { email: true, name: true },
      });

      if (!user?.email) {
        this.logger.warn(
          `Cannot send purchase failed email: user ${event.userId} has no email`,
        );
        return;
      }

      await this.emailService.sendPurchaseFailedEmail(user.email, {
        userName: user.name || undefined,
        reason:
          "There was an issue processing your payment. Please review your payment details and try again.",
        retryUrl: "https://app.creatorhubplatform.com/credits",
      });

      this.logger.log(`Purchase failed email sent to ${user.email}`);
    } catch (error) {
      this.logger.error("Failed to send purchase failed email", {
        error: (error as Error).message,
        userId: event.userId,
      });
    }
  }
}
