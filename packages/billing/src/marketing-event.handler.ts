import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { prisma } from "@creator-hub/database";
import {
  DomainEventPublisher,
  DOMAIN_EVENT_PUBLISHER,
} from "@creator-hub/domain-events";
import {
  CREDIT_STATE_REACHED_CHANNEL,
  type CreditState,
  type CreditStateReachedEvent,
  type MarketingCreditDepletedEvent,
  type MarketingCreditThresholdEvent,
} from "@creator-hub/shared-types";

@Injectable()
export class MarketingEventHandler {
  private readonly logger = new Logger("MarketingEventHandler");

  constructor(
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  @OnEvent("marketing.credit_threshold")
  async handleCreditThreshold(
    event: MarketingCreditThresholdEvent,
  ): Promise<void> {
    const { userId, threshold, creditsRemaining, previousCredits } = event;

    this.logger.log(`Marketing threshold triggered`, {
      userId,
      threshold,
      creditsRemaining,
    });

    const state = `CREDIT_THRESHOLD_${threshold}` as CreditState;
    const marketingEvent = await prisma.marketingEvent.create({
      data: {
        userId,
        type: state,
        credits: creditsRemaining,
        metadata: {
          triggeredAt: new Date().toISOString(),
          source: "credit-deduction",
          ...(previousCredits !== undefined && { previousCredits }),
        },
      },
    });

    await this.publishStateReached({
      userId,
      state,
      creditsRemaining,
      previousCredits: previousCredits ?? null,
      marketingEventId: marketingEvent.id,
      timestamp: new Date(),
    });
  }

  @OnEvent("marketing.credit_depleted")
  async handleCreditDepleted(
    event: MarketingCreditDepletedEvent,
  ): Promise<void> {
    const { userId, creditsRemaining, previousCredits } = event;

    this.logger.log(`Credit depleted - upgrade prompt triggered`, { userId });

    const marketingEvent = await prisma.marketingEvent.create({
      data: {
        userId,
        type: "CREDIT_DEPLETED",
        credits: 0,
        metadata: {
          triggeredAt: new Date().toISOString(),
          source: "credit-deduction",
          ...(previousCredits !== undefined && { previousCredits }),
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: "CREDIT_LOW",
        title: "No credits remaining",
        body: "You've used all your free credits. Upgrade to Pro to continue creating!",
        data: {
          action: "upgrade",
          url: "/pricing",
        },
      },
    });

    await this.publishStateReached({
      userId,
      state: "CREDIT_DEPLETED",
      creditsRemaining: creditsRemaining ?? null,
      previousCredits: previousCredits ?? null,
      marketingEventId: marketingEvent.id,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcasts the recorded state over Redis so other processes (the API's
   * CreditEmailListener) can react — same pattern as `payment:success`.
   * The community worker also deducts credits, so an in-process event alone
   * would never reach the API. A Redis outage must not fail the handler.
   */
  private async publishStateReached(
    event: CreditStateReachedEvent,
  ): Promise<void> {
    try {
      await this.eventPublisher.publish(CREDIT_STATE_REACHED_CHANNEL, event);
    } catch (error) {
      this.logger.error(`Failed to publish ${CREDIT_STATE_REACHED_CHANNEL}`, {
        userId: event.userId,
        state: event.state,
        error: (error as Error).message,
      });
    }
  }
}
