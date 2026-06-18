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
import type { PaymentSuccessEvent } from "@creator-hub/shared-types";

const PAYMENT_SUCCESS_CHANNEL = "payment:success";

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

    this.logger.log("Subscribed to payment events");
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(PAYMENT_SUCCESS_CHANNEL);
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
      });
    } catch (error) {
      this.logger.error("Failed to emit payment success via WebSocket", {
        error: (error as Error).message,
        userId: event.userId,
      });
    }
  }
}
