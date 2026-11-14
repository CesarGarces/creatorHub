import { Injectable, Logger } from "@nestjs/common";
import { prisma, Prisma } from "@creator-hub/database";
import { EmailService } from "@creator-hub/email";
import type {
  CreditStateEmailContent,
  CreditStateEmailVariables,
  RenderedEmail,
} from "@creator-hub/email";
import { getCrossedCreditStates } from "@creator-hub/billing";
import {
  CREDIT_STATE_BALANCE,
  type CreditState,
  type CreditStateReachedEvent,
} from "@creator-hub/shared-types";

const DEFAULT_FRONTEND_URL = "https://app.creatorhubplatform.com";

export type CreditEmailOutcome =
  | "sent"
  | "failed"
  | "no-trigger"
  | "user-not-eligible"
  | "already-sent";

/**
 * Sends the admin-configured email for a credit state (CreditEmailTrigger).
 *
 * Exactly-once delivery follows the same rule as credit grants (SEC-03/06):
 * a deterministic idempotency key with a DB unique constraint. The key is
 * "{userId}:{state}:{creditCycle}", where the credit cycle is the user's
 * latest credit-adding CreditTransaction. So a user gets each state's email
 * once, and again only after they receive credits (purchase, bonus, ...)
 * and cross the threshold again. Redis delivery to several API replicas,
 * repeated rejected debits at 0 credits, and retries cannot send duplicates.
 */
@Injectable()
export class CreditEmailService {
  private readonly logger = new Logger("CreditEmailService");

  constructor(private readonly emailService: EmailService) {}

  async handleStateReached(
    event: CreditStateReachedEvent,
  ): Promise<CreditEmailOutcome> {
    const trigger = await this.findTrigger(event);
    if (!trigger) return "no-trigger";

    const user = await prisma.user.findUnique({
      where: { id: event.userId },
      select: { email: true, name: true, isActive: true, currentCredits: true },
    });
    if (!user?.email || !user.isActive) {
      this.logger.warn(
        `Credit email skipped: user ${event.userId} is inactive or has no email`,
      );
      return "user-not-eligible";
    }

    // Triggers can only be created for credit states (validated by the DTO).
    const state = trigger.state as CreditState;
    const credits = event.creditsRemaining ?? user.currentCredits;
    const dedupeKey = await this.buildDedupeKey(event.userId, state);

    const log = await this.claim({
      userId: event.userId,
      triggerId: trigger.id,
      state,
      credits,
      email: user.email,
      subject: trigger.subject,
      dedupeKey,
    });
    if (!log) return "already-sent";

    const result = await this.emailService.sendCreditStateEmail(
      user.email,
      trigger,
      this.buildVariables(user, credits, state),
    );

    await prisma.creditEmailLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? "SENT" : "FAILED",
        subject: result.subject,
        error: result.success ? null : (result.error ?? "Unknown error"),
      },
    });

    this.logger.log(
      `Credit email "${state}" ${result.success ? "sent" : "failed"} for user ${event.userId}`,
    );
    return result.success ? "sent" : "failed";
  }

  /** Renders unsaved trigger content for the admin preview. */
  preview(content: CreditStateEmailContent, state: CreditState): RenderedEmail {
    const credits = CREDIT_STATE_BALANCE[state];
    return this.emailService.renderCreditStateEmail(
      content,
      this.buildVariables(
        { name: "Jane Doe", email: "jane@example.com" },
        credits,
        state,
      ),
    );
  }

  /** Sends a saved trigger to an admin, with sample values. Not deduplicated. */
  async sendTest(triggerId: string, adminUserId: string) {
    const [trigger, admin] = await Promise.all([
      prisma.creditEmailTrigger.findUnique({ where: { id: triggerId } }),
      prisma.user.findUnique({
        where: { id: adminUserId },
        select: { email: true, name: true },
      }),
    ]);
    if (!trigger || !admin?.email) return null;

    const state = trigger.state as CreditState;
    const credits = CREDIT_STATE_BALANCE[state];
    const result = await this.emailService.sendCreditStateEmail(
      admin.email,
      trigger,
      this.buildVariables(admin, credits, state),
    );

    return prisma.creditEmailLog.create({
      data: {
        userId: adminUserId,
        triggerId: trigger.id,
        state: trigger.state,
        credits,
        email: admin.email,
        subject: result.subject,
        status: result.success ? "SENT" : "FAILED",
        error: result.success ? null : (result.error ?? "Unknown error"),
        isTest: true,
      },
    });
  }

  /**
   * The active trigger to send: the most severe state crossed by the debit
   * that has an active email. If a debit jumps from 60 to 20 credits and only
   * the 50-credit email exists, the user still gets it.
   */
  private async findTrigger(event: CreditStateReachedEvent) {
    const crossed =
      event.previousCredits !== null && event.creditsRemaining !== null
        ? getCrossedCreditStates(event.previousCredits, event.creditsRemaining)
        : [];
    const candidates = crossed.includes(event.state)
      ? crossed
      : [event.state, ...crossed];

    const triggers = await prisma.creditEmailTrigger.findMany({
      where: { state: { in: candidates }, isActive: true },
    });
    for (const state of candidates) {
      const trigger = triggers.find((t) => t.state === state);
      if (trigger) return trigger;
    }
    return null;
  }

  private async buildDedupeKey(
    userId: string,
    state: CreditState,
  ): Promise<string> {
    const lastCreditGrant = await prisma.creditTransaction.findFirst({
      where: { userId, amount: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return `${userId}:${state}:${lastCreditGrant?.id ?? "initial"}`;
  }

  /**
   * Inserts a PENDING log row. The unique dedupeKey makes this the claim:
   * only one caller wins. A previous FAILED attempt may be re-claimed.
   * Returns null when the email was already sent (or is being sent).
   */
  private async claim(data: {
    userId: string;
    triggerId: string;
    state: CreditState;
    credits: number;
    email: string;
    subject: string;
    dedupeKey: string;
  }) {
    try {
      return await prisma.creditEmailLog.create({
        data: { ...data, status: "PENDING" },
      });
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
      ) {
        throw error;
      }
      const retried = await prisma.creditEmailLog.updateMany({
        where: { dedupeKey: data.dedupeKey, status: "FAILED" },
        data: {
          status: "PENDING",
          error: null,
          triggerId: data.triggerId,
          credits: data.credits,
        },
      });
      if (retried.count === 0) return null;
      return prisma.creditEmailLog.findUnique({
        where: { dedupeKey: data.dedupeKey },
      });
    }
  }

  private buildVariables(
    user: { name: string | null; email: string },
    credits: number,
    state: CreditState,
  ): CreditStateEmailVariables {
    return {
      name: user.name?.trim() || user.email,
      credits,
      threshold: CREDIT_STATE_BALANCE[state],
      purchaseUrl: `${this.frontendUrl()}/credits`,
    };
  }

  private frontendUrl(): string {
    const url = process.env.FRONTEND_URL;
    return url && /^https?:\/\//.test(url)
      ? url.replace(/\/+$/, "")
      : DEFAULT_FRONTEND_URL;
  }
}
