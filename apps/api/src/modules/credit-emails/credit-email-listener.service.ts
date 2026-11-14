import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  DomainEventSubscriber,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import {
  CREDIT_STATE_REACHED_CHANNEL,
  isCreditState,
  type CreditStateReachedEvent,
} from "@creator-hub/shared-types";
import { CreditEmailService } from "./credit-email.service";

/**
 * Sends credit state emails (50 credits left, out of credits, ...) when
 * MarketingEventHandler publishes `credit.state_reached` — same pattern as
 * PaymentEmailListenerService for `payment:success`.
 */
@Injectable()
export class CreditEmailListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("CreditEmailListenerService");

  constructor(
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private readonly eventSubscriber: DomainEventSubscriber,
    private readonly creditEmailService: CreditEmailService,
  ) {}

  async onModuleInit() {
    await this.eventSubscriber.subscribe<CreditStateReachedEvent>(
      CREDIT_STATE_REACHED_CHANNEL,
      this.handleStateReached.bind(this),
    );
    this.logger.log(`Subscribed to ${CREDIT_STATE_REACHED_CHANNEL}`);
  }

  async onModuleDestroy() {
    await this.eventSubscriber.unsubscribe(CREDIT_STATE_REACHED_CHANNEL);
  }

  async handleStateReached(event: CreditStateReachedEvent): Promise<void> {
    // The subscriber does not await handlers: never let an error escape.
    try {
      if (!event?.userId || !isCreditState(event.state)) {
        this.logger.warn("Ignoring malformed credit.state_reached event", {
          event,
        });
        return;
      }
      const outcome = await this.creditEmailService.handleStateReached(event);
      this.logger.log(
        `Credit state ${event.state} for user ${event.userId}: ${outcome}`,
      );
    } catch (error) {
      this.logger.error("Failed to process credit state email", {
        userId: event?.userId,
        state: event?.state,
        error: (error as Error).message,
      });
    }
  }
}
