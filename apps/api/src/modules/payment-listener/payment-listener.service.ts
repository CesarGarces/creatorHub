import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Inject } from "@nestjs/common";
import { AppGateway } from "../websocket/websocket.gateway";
import {
  DomainEventSubscriber,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import type {
  PaymentSuccessEvent,
  PaymentFailedEvent,
  PaymentPendingEvent,
} from "@creator-hub/shared-types";

const PAYMENT_SUCCESS_CHANNEL = "payment:success";
const PAYMENT_FAILED_CHANNEL = "payment:failed";
const PAYMENT_PENDING_CHANNEL = "payment:pending";

@Injectable()
export class PaymentListenerService implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger("PaymentListenerService");

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private eventSubscriber: DomainEventSubscriber,
    private gateway: AppGateway,
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
    await this.eventSubscriber.subscribe<PaymentPendingEvent>(
      PAYMENT_PENDING_CHANNEL,
      this.handlePaymentPending.bind(this),
    );

    this.logger.log("Subscribed to payment events (success, failed, pending)");
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(PAYMENT_SUCCESS_CHANNEL);
    await this.eventSubscriber.unsubscribe(PAYMENT_FAILED_CHANNEL);
    await this.eventSubscriber.unsubscribe(PAYMENT_PENDING_CHANNEL);
    this.logger.log("Unsubscribed from payment events");
  }

  private async handlePaymentSuccess(event: PaymentSuccessEvent) {
    this.logger.log(
      "Payment success received, emitting to user via WebSocket",
      {
        userId: event.userId,
        gatewayTxId: event.gatewayTxId,
        amount: event.amount,
      },
    );

    try {
      this.gateway.emitToUser(event.userId, "payment:success", {
        gatewayTxId: event.gatewayTxId,
        amount: event.amount,
        balance: event.balance,
        gateway: event.gateway,
        status: "success",
        message: "Credits added to your account",
      });
    } catch (error) {
      this.logger.error("Failed to emit payment success via WebSocket", {
        error: (error as Error).message,
        userId: event.userId,
      });
    }
  }

  private async handlePaymentFailed(event: PaymentFailedEvent) {
    this.logger.log("Payment failed received, emitting to user via WebSocket", {
      userId: event.userId,
      gatewayTxId: event.gatewayTxId,
      reason: event.reason,
    });

    try {
      this.gateway.emitToUser(event.userId, "payment:failed", {
        gatewayTxId: event.gatewayTxId,
        gateway: event.gateway,
        status: "failed",
        message: "Payment was not processed. Please try again.",
      });
    } catch (error) {
      this.logger.error("Failed to emit payment:failed via WebSocket", {
        error: (error as Error).message,
        userId: event.userId,
      });
    }
  }

  private async handlePaymentPending(event: PaymentPendingEvent) {
    this.logger.log(
      "Payment pending received, emitting to user via WebSocket",
      {
        userId: event.userId,
        gatewayTxId: event.gatewayTxId,
      },
    );

    try {
      this.gateway.emitToUser(event.userId, "payment:pending", {
        gatewayTxId: event.gatewayTxId,
        gateway: event.gateway,
        status: "pending",
        message:
          "We are verifying your payment. Credits will be added shortly.",
      });
    } catch (error) {
      this.logger.error("Failed to emit payment:pending via WebSocket", {
        error: (error as Error).message,
        userId: event.userId,
      });
    }
  }
}
