import { Inject, Injectable } from "@nestjs/common";
import { prisma } from "@creator-hub/database";
import { CreditService } from "@creator-hub/billing";
import type { CommunityReplySkippedEvent } from "@creator-hub/shared-types";

export type GuardRejection = {
  allowed: false;
  reason: CommunityReplySkippedEvent["reason"];
};

export type GuardVerdict = { allowed: true } | GuardRejection;

interface GuardInput {
  userId: string;
  isEnabled: boolean;
  contactId: string;
  contactIsBlocked: boolean;
  contactLastReplyAt: Date | null;
  perContactCooldownSec: number;
  dailyReplyLimit: number;
  creditCost: number;
}

/**
 * Cost and abuse controls. Every inbound message passes these guards
 * BEFORE any AI call is made, so a spammy fan can never drain the
 * creator's credits. Order matters: cheap checks first, credit check
 * last.
 */
@Injectable()
export class CommunityGuardService {
  constructor(
    @Inject(CreditService) private readonly creditService: CreditService,
  ) {}

  async evaluate(input: GuardInput): Promise<GuardVerdict> {
    if (!input.isEnabled) {
      return { allowed: false, reason: "bot_disabled" };
    }

    if (input.contactIsBlocked) {
      return { allowed: false, reason: "blocked_contact" };
    }

    if (input.contactLastReplyAt && input.perContactCooldownSec > 0) {
      const cooldownMs = input.perContactCooldownSec * 1000;
      const elapsed = Date.now() - input.contactLastReplyAt.getTime();
      if (elapsed < cooldownMs) {
        return { allowed: false, reason: "cooldown" };
      }
    }

    if (await this.isDailyLimitReached(input.userId, input.dailyReplyLimit)) {
      return { allowed: false, reason: "daily_limit" };
    }

    const hasCredits = await this.creditService.hasEnoughCredits(
      input.userId,
      input.creditCost,
    );
    if (!hasCredits) {
      return { allowed: false, reason: "insufficient_credits" };
    }

    return { allowed: true };
  }

  private async isDailyLimitReached(
    userId: string,
    dailyReplyLimit: number,
  ): Promise<boolean> {
    if (dailyReplyLimit <= 0) return false;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const repliesToday = await prisma.communityMessage.count({
      where: {
        direction: "OUTBOUND",
        status: { in: ["SENT", "PROCESSING"] },
        createdAt: { gte: startOfDay },
        conversation: { channel: { userId } },
      },
    });

    return repliesToday >= dailyReplyLimit;
  }
}
