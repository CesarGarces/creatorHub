import { Injectable, Inject } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { Logger } from "@creator-hub/shared-utils";
import {
  DomainEventPublisher,
  DOMAIN_EVENT_PUBLISHER,
} from "@creator-hub/domain-events";

@Injectable()
export class MarketingEventService {
  private readonly logger = new Logger("MarketingEventService");
  private readonly THRESHOLDS = [75, 25, 10, 5];

  constructor(
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private eventPublisher: DomainEventPublisher,
  ) {}

  async checkCreditThresholds(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const totalCredits = user.currentCredits + user.purchasedCredits;

    for (const threshold of this.THRESHOLDS) {
      if (totalCredits === threshold) {
        await prisma.marketingEvent.create({
          data: {
            userId,
            type: `CREDIT_THRESHOLD_${threshold}` as any,
            credits: totalCredits,
          },
        });

        await this.eventPublisher.publish("marketing.credit_threshold", {
          userId,
          threshold,
          creditsRemaining: totalCredits,
          timestamp: new Date(),
        });

        this.logger.info(`Marketing threshold reached`, {
          userId,
          threshold,
          creditsRemaining: totalCredits,
        });

        break;
      }
    }

    if (totalCredits === 0) {
      await prisma.marketingEvent.create({
        data: {
          userId,
          type: "CREDIT_DEPLETED",
          credits: 0,
        },
      });

      await this.eventPublisher.publish("marketing.credit_depleted", {
        userId,
        timestamp: new Date(),
      });

      this.logger.info(`Credit depleted`, { userId });
    }
  }
}
