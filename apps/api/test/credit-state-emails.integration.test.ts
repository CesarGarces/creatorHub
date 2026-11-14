/**
 * Credit state emails — integration test against a REAL PostgreSQL database.
 *
 * Runs the whole flow with real Nest wiring (@OnEvent handlers) and real
 * Prisma queries; only Redis and the email provider are replaced:
 *
 *   CreditService.deduct()
 *     → "marketing.credit_threshold" / "marketing.credit_depleted" (EventEmitter2)
 *     → MarketingEventHandler (MarketingEvent row + publish "credit.state_reached")
 *     → CreditEmailListenerService → CreditEmailService → EmailService
 *
 *   DATABASE_URL=postgresql://... npx vitest --run test/
 *
 * Skipped when DATABASE_URL is not set or the schema is not applied.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { CreditService, MarketingEventHandler } from "@creator-hub/billing";
import { prisma } from "@creator-hub/database";
import {
  DOMAIN_EVENT_PUBLISHER,
  DOMAIN_EVENT_SUBSCRIBER,
} from "@creator-hub/domain-events";
import { EmailProvider, EmailService } from "@creator-hub/email";
import { CreditEmailService } from "../src/modules/credit-emails/credit-email.service";
import { CreditEmailListenerService } from "../src/modules/credit-emails/credit-email-listener.service";

let dbReady = false;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "CreditEmailTrigger" LIMIT 1`);
    dbReady = true;
  } catch {
    // DB unreachable or schema not applied — skip suite.
  }
});

const TIMEOUT = 30_000;

/** In-memory stand-in for Redis pub/sub (JSON round-trip like the real one). */
class InMemoryEventBus {
  private handlers = new Map<string, (event: unknown) => unknown>();
  async publish(channel: string, event: unknown) {
    const handler = this.handlers.get(channel);
    if (handler) void handler(JSON.parse(JSON.stringify(event)));
  }
  async subscribe(channel: string, handler: (event: unknown) => unknown) {
    this.handlers.set(channel, handler);
  }
  async unsubscribe(channel: string) {
    this.handlers.delete(channel);
  }
}

class FakeEmailProvider extends EmailProvider {
  sent: { to: string; subject: string; html: string }[] = [];
  async send(options: { to: string; subject: string; html: string }) {
    this.sent.push(options);
    return { id: `email-${this.sent.length}`, success: true };
  }
}

async function waitFor<T>(
  fn: () => Promise<T | null | undefined | false>,
  ms = 5000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - start > ms) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** Lets fire-and-forget handlers finish before asserting that nothing happened. */
const settle = () => new Promise((r) => setTimeout(r, 300));

describe("credit state emails (real DB)", () => {
  const TEST_STATES = ["CREDIT_THRESHOLD_50", "CREDIT_DEPLETED"] as const;
  let moduleRef: TestingModule;
  let creditService: CreditService;
  let provider: FakeEmailProvider;
  let savedTriggers: any[] = [];
  const userIdsToClean: string[] = [];

  beforeAll(async () => {
    if (!dbReady) return;

    // Keep whatever the admin configured and restore it afterwards.
    savedTriggers = await prisma.creditEmailTrigger.findMany({
      where: { state: { in: [...TEST_STATES] } },
    });
    await prisma.creditEmailTrigger.deleteMany({
      where: { state: { in: [...TEST_STATES] } },
    });
    await prisma.creditEmailTrigger.createMany({
      data: [
        {
          state: "CREDIT_THRESHOLD_50",
          subject: "You have {{credits}} credits left",
          heading: "Running low",
          body: "Hi {{name}}, {{credits}} credits left.",
          ctaLabel: "Buy credits",
          ctaUrl: "{{purchaseUrl}}",
        },
        {
          state: "CREDIT_DEPLETED",
          subject: "You're out of credits",
          heading: "No credits left",
          body: "Hi {{name}}, purchase credits to continue.",
          ctaLabel: "Purchase credits",
          ctaUrl: "{{purchaseUrl}}",
        },
      ],
    });

    provider = new FakeEmailProvider();
    const bus = new InMemoryEventBus();
    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      // Factories instead of class providers: vitest (esbuild) does not emit
      // decorator metadata, so Nest could not resolve class-typed
      // constructor params here. `nest build` (tsc) emits it in production.
      providers: [
        MarketingEventHandler,
        { provide: EmailProvider, useValue: provider },
        { provide: DOMAIN_EVENT_PUBLISHER, useValue: bus },
        { provide: DOMAIN_EVENT_SUBSCRIBER, useValue: bus },
        {
          provide: EmailService,
          useFactory: (p: EmailProvider) => new EmailService(p),
          inject: [EmailProvider],
        },
        {
          provide: CreditEmailService,
          useFactory: (email: EmailService) => new CreditEmailService(email),
          inject: [EmailService],
        },
        {
          provide: CreditEmailListenerService,
          useFactory: (sub: any, svc: CreditEmailService) =>
            new CreditEmailListenerService(sub, svc),
          inject: [DOMAIN_EVENT_SUBSCRIBER, CreditEmailService],
        },
      ],
    }).compile();
    await moduleRef.init();

    creditService = new CreditService(
      { add: async () => ({}) } as never,
      moduleRef.get(EventEmitter2),
    );
  });

  afterAll(async () => {
    if (!dbReady) return;
    await moduleRef?.close();
    for (const id of userIdsToClean) {
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.creditEmailTrigger.deleteMany({
      where: { state: { in: [...TEST_STATES] } },
    });
    for (const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      ...trigger
    } of savedTriggers) {
      await prisma.creditEmailTrigger.create({ data: trigger });
    }
  });

  async function createUser(credits: number) {
    const user = await prisma.user.create({
      data: {
        email: `it-credit-emails-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`,
        name: "Ana",
        passwordHash: "x",
        currentCredits: 0,
      },
    });
    userIdsToClean.push(user.id);
    await creditService.addCredits(user.id, credits, "Signup bonus", "BONUS");
    return user;
  }

  const logsFor = (userId: string) =>
    prisma.creditEmailLog.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  const sentTo = (email: string) => provider.sent.filter((m) => m.to === email);

  it(
    "emails once at 50 credits and once at 0, and again after a purchase",
    async () => {
      if (!dbReady) return; // skip — no DB schema
      const user = await createUser(100);

      // 100 → 70: enters CREDIT_THRESHOLD_75 (recorded, but no email configured)
      expect(await creditService.deduct(user.id, 30)).toBe(true);
      await waitFor(() =>
        prisma.marketingEvent.findFirst({
          where: { userId: user.id, type: "CREDIT_THRESHOLD_75" },
        }),
      );

      // 70 → 48: crosses 50 → the 50-credit email
      expect(await creditService.deduct(user.id, 22)).toBe(true);
      const event50 = await waitFor(() =>
        prisma.marketingEvent.findFirst({
          where: { userId: user.id, type: "CREDIT_THRESHOLD_50" },
        }),
      );
      expect(event50.credits).toBe(48);
      await waitFor(async () =>
        (await logsFor(user.id)).some((l) => l.status === "SENT"),
      );
      expect(sentTo(user.email)).toHaveLength(1);
      expect(sentTo(user.email)[0].subject).toBe("You have 48 credits left");

      // 48 → 40: no new state, no email
      expect(await creditService.deduct(user.id, 8)).toBe(true);
      await settle();
      expect(sentTo(user.email)).toHaveLength(1);

      // 40 → 0: CREDIT_DEPLETED → purchase email + in-app notification
      expect(await creditService.deduct(user.id, 40)).toBe(true);
      await waitFor(async () => sentTo(user.email).length === 2);
      expect(sentTo(user.email)[1].subject).toBe("You're out of credits");
      expect(sentTo(user.email)[1].html).toContain("Purchase credits");
      await waitFor(() =>
        prisma.notification.findFirst({ where: { userId: user.id } }),
      );

      // Rejected debit at 0 credits → CREDIT_DEPLETED again, but no 2nd email
      expect(await creditService.deduct(user.id, 5)).toBe(false);
      await waitFor(
        async () =>
          (await prisma.marketingEvent.count({
            where: { userId: user.id, type: "CREDIT_DEPLETED" },
          })) === 2,
      );
      await settle();
      expect(sentTo(user.email)).toHaveLength(2);

      // Purchase (new credit cycle) → crossing 50 again emails again
      await creditService.addCredits(
        user.id,
        100,
        "Credit purchase",
        "PURCHASE",
      );
      expect(await creditService.deduct(user.id, 55)).toBe(true); // 100 → 45
      await waitFor(async () => sentTo(user.email).length === 3);
      expect(sentTo(user.email)[2].subject).toBe("You have 45 credits left");

      // The log row flips PENDING → SENT right after the provider call.
      const logs = await waitFor(async () => {
        const rows = await logsFor(user.id);
        return (
          rows.length === 3 && rows.every((l) => l.status === "SENT") && rows
        );
      });
      expect(logs.map((l) => [l.state, l.status])).toEqual([
        ["CREDIT_THRESHOLD_50", "SENT"],
        ["CREDIT_DEPLETED", "SENT"],
        ["CREDIT_THRESHOLD_50", "SENT"],
      ]);
    },
    TIMEOUT,
  );

  it(
    "sends exactly one email when the same state is delivered to several API replicas",
    async () => {
      if (!dbReady) return; // skip — no DB schema
      const user = await createUser(49);
      const event = {
        userId: user.id,
        state: "CREDIT_THRESHOLD_50" as const,
        creditsRemaining: 49,
        previousCredits: 55,
        marketingEventId: "replica-test",
        timestamp: new Date(),
      };

      // 5 "replicas" (separate service instances) receive the same Redis message.
      const emailService = moduleRef.get(EmailService);
      const outcomes = await Promise.all(
        Array.from({ length: 5 }, () =>
          new CreditEmailService(emailService).handleStateReached(event),
        ),
      );

      expect(outcomes.filter((o) => o === "sent")).toHaveLength(1);
      expect(outcomes.filter((o) => o === "already-sent")).toHaveLength(4);
      expect(sentTo(user.email)).toHaveLength(1);
      expect(await logsFor(user.id)).toHaveLength(1);
    },
    TIMEOUT,
  );
});
