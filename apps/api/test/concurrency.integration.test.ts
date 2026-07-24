/**
 * Concurrency integration tests — security hardening (SEC-01, SEC-02, SEC-03, SEC-06).
 *
 * These tests run against a REAL PostgreSQL database because the guarantees
 * under test live at the database level (unique constraints, transactions):
 *
 *   DATABASE_URL=postgresql://... npx vitest --run test/
 *
 * When DATABASE_URL is not set the whole suite is skipped (safe for CI
 * pipelines without a database).
 */
import { describe, it, expect, afterEach } from "vitest";
import { ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "@creator-hub/auth";
import {
  CreditBillingService,
  CreditService,
  PaymentGateway,
} from "@creator-hub/billing";
import { prisma } from "@creator-hub/database";

const HAS_DB = !!process.env.DATABASE_URL;
const describeDb = HAS_DB ? describe : describe.skip;

const TIMEOUT = 30_000;

function makeAuthService() {
  return new AuthService(
    new JwtService({ secret: "integration-test-secret" }),
    {} as never,
  );
}

function makeCreditService() {
  return new CreditService(
    { add: async () => ({}) } as never,
    { emit: () => true } as never,
  );
}

function makeCreditBillingService() {
  const creditService = makeCreditService();
  const eventPublisher = { publish: async () => {} };
  return new CreditBillingService(creditService, eventPublisher as never);
}

describeDb("concurrency hardening (real DB)", () => {
  const emailsToClean: string[] = [];
  const userIdsToClean: string[] = [];

  afterEach(async () => {
    for (const email of emailsToClean.splice(0)) {
      await prisma.user.deleteMany({ where: { email } });
    }
    for (const id of userIdsToClean.splice(0)) {
      await prisma.user.deleteMany({ where: { id } });
    }
  });

  it(
    "two concurrent registrations with the same email create exactly one user, " +
      "one subscription and one signup bonus (SEC-01, SEC-02, SEC-06)",
    async () => {
      const email = `it-register-race-${Date.now()}@test.local`;
      emailsToClean.push(email);
      const service = makeAuthService();

      const results = await Promise.allSettled([
        service.register(email, "password123", "Race A"),
        service.register(email, "password123", "Race B"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const conflicts = results.filter(
        (r) => r.status === "rejected" && r.reason instanceof ConflictException,
      );
      const unexpected = results.filter(
        (r) =>
          r.status === "rejected" && !(r.reason instanceof ConflictException),
      );

      // One winner, one clean 409 — never an unhandled 500 (P2002 mapping).
      expect(fulfilled).toHaveLength(1);
      expect(conflicts).toHaveLength(1);
      expect(unexpected).toHaveLength(0);

      const user = await prisma.user.findUnique({
        where: { email },
        include: { subscriptions: true },
      });
      expect(user).not.toBeNull();
      expect(user!.subscriptions).toHaveLength(1);
      expect(user!.currentCredits).toBe(100);

      const bonusTxns = await prisma.creditTransaction.findMany({
        where: { referenceId: `signup:${user!.id}` },
      });
      expect(bonusTxns).toHaveLength(1);
      expect(bonusTxns[0].type).toBe("BONUS");
      expect(bonusTxns[0].amount).toBe(100);
    },
    TIMEOUT,
  );

  it(
    "the signup bonus referenceId is unique at DB level — a second grant for " +
      "the same user is rejected (SEC-06)",
    async () => {
      const email = `it-bonus-once-${Date.now()}@test.local`;
      emailsToClean.push(email);
      const service = makeAuthService();
      await service.register(email, "password123", "Bonus");

      const user = await prisma.user.findUnique({ where: { email } });
      await expect(
        prisma.creditTransaction.create({
          data: {
            userId: user!.id,
            amount: 100,
            type: "BONUS",
            description: "Duplicate signup bonus attempt",
            referenceId: `signup:${user!.id}`,
            balance: 200,
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    },
    TIMEOUT,
  );

  it(
    "two concurrent payment webhooks with the same referenceId credit the " +
      "user exactly once and both are acknowledged (SEC-03)",
    async () => {
      const user = await prisma.user.create({
        data: {
          email: `it-webhook-race-${Date.now()}@test.local`,
          passwordHash: "x",
          plan: "FREE",
          currentCredits: 0,
          purchasedCredits: 0,
        },
      });
      userIdsToClean.push(user.id);
      const service = makeCreditBillingService();

      const referenceId = `it-pay-${Date.now()}`;
      const args = [
        PaymentGateway.MERCADO_PAGO,
        { isValid: true, status: "SUCCESSFUL", gatewayTxId: referenceId },
        { external_reference: user.id, transaction_amount: 10 },
      ] as const;

      const results = await Promise.allSettled([
        service.reconcilePayment(...args),
        service.reconcilePayment(...args),
      ]);

      // Duplicate webhook must be acknowledged (200 to gateway), never error.
      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected).toHaveLength(0);

      const txns = await prisma.creditTransaction.findMany({
        where: { referenceId },
      });
      expect(txns).toHaveLength(1);

      const finalUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      // 10 USD at the PAY_AS_YOU_GO seed rate (10 USD -> 1000 credits).
      expect(txns[0].amount).toBe(1000);
      expect(finalUser!.currentCredits).toBe(1000);
    },
    TIMEOUT,
  );

  it(
    "many concurrent debits can never drive the balance negative — each " +
      "debit is an atomic conditional update (SEC-07)",
    async () => {
      const user = await prisma.user.create({
        data: {
          email: `it-deduct-race-${Date.now()}@test.local`,
          passwordHash: "x",
          plan: "FREE",
          currentCredits: 100,
          purchasedCredits: 0,
        },
      });
      userIdsToClean.push(user.id);
      const service = makeCreditService();

      // 10 concurrent debits of 30 against a balance of 100:
      // exactly 3 may succeed (3*30 <= 100), the rest must fail cleanly.
      const results = await Promise.all(
        Array.from({ length: 10 }, () => service.deduct(user.id, 30)),
      );

      const succeeded = results.filter(Boolean).length;
      expect(succeeded).toBe(3);

      const finalUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(finalUser!.currentCredits).toBe(10);
      expect(finalUser!.currentCredits).toBeGreaterThanOrEqual(0);

      const usageTxns = await prisma.creditTransaction.findMany({
        where: { userId: user.id, type: "USAGE" },
      });
      expect(usageTxns).toHaveLength(3);
    },
    TIMEOUT,
  );
});
