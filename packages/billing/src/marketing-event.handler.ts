import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { prisma } from "@creator-hub/database";

@Injectable()
export class MarketingEventHandler {
  private readonly logger = new Logger("MarketingEventHandler");

  @OnEvent("marketing.credit_threshold")
  async handleCreditThreshold(event: {
    userId: string;
    threshold: number;
    creditsRemaining: number;
    timestamp: Date;
  }): Promise<void> {
    const { userId, threshold, creditsRemaining } = event;

    this.logger.log(`Marketing threshold triggered`, {
      userId,
      threshold,
      creditsRemaining,
    });

    await prisma.marketingEvent.create({
      data: {
        userId,
        type: `CREDIT_THRESHOLD_${threshold}` as any,
        credits: creditsRemaining,
        metadata: {
          triggeredAt: new Date().toISOString(),
          source: "credit-deduction",
        },
      },
    });
  }

  @OnEvent("marketing.credit_depleted")
  async handleCreditDepleted(event: { userId: string; timestamp: Date }): Promise<void> {
    const { userId } = event;

    this.logger.log(`Credit depleted - upgrade prompt triggered`, { userId });

    await prisma.marketingEvent.create({
      data: {
        userId,
        type: "CREDIT_DEPLETED",
        credits: 0,
        metadata: {
          triggeredAt: new Date().toISOString(),
          source: "credit-deduction",
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
  }
}
