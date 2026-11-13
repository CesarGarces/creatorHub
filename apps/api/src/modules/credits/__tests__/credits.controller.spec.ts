import { beforeEach, describe, expect, it, vi } from "vitest";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";
import { PaymentGateway } from "@creator-hub/billing";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { CreditsController } from "../credits.controller";

describe("CreditsController", () => {
  const creditService = {};
  const billingService = { getPlans: vi.fn(), subscribe: vi.fn() };
  const gateway = { createCheckoutSession: vi.fn() };
  const paymentRegistry = { getGateway: vi.fn(() => gateway) };
  const controller = new CreditsController(
    creditService as never,
    billingService as never,
    paymentRegistry as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
    gateway.createCheckoutSession.mockResolvedValue({
      paymentUrl: "https://pay.example/checkout",
      gatewayTxId: "tx-1",
      preferenceId: "pref-1",
    });
  });

  it("requires authentication", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CreditsController)).toEqual([
      JwtAuthGuard,
    ]);
  });

  describe("getBalance", () => {
    it("returns the user's credits and plan", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        currentCredits: 120,
        purchasedCredits: 50,
        plan: "PRO",
      });

      expect(await controller.getBalance("u1")).toEqual({
        balance: 120,
        currentCredits: 120,
        purchasedCredits: 50,
        plan: "PRO",
      });
      expect(prismaMock.user.findUnique.mock.calls[0]![0].where).toEqual({
        id: "u1",
      });
    });

    it("returns zeroed FREE defaults when the user is missing", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      expect(await controller.getBalance("ghost")).toEqual({
        balance: 0,
        currentCredits: 0,
        purchasedCredits: 0,
        plan: "FREE",
      });
    });
  });

  describe("getTransactions", () => {
    it("attaches the AI model used when a log for the same tool is within 30s", async () => {
      const t0 = new Date("2026-03-01T10:00:00Z");
      prismaMock.creditTransaction.findMany.mockResolvedValue([
        {
          id: "tx1",
          amount: -10,
          type: "USAGE",
          description: "Thumbnail",
          provider: null,
          balance: 90,
          toolId: "thumb",
          tool: { name: "Thumbnails", icon: "🖼" },
          createdAt: t0,
        },
        {
          id: "tx2",
          amount: -5,
          type: "USAGE",
          description: "Old",
          provider: null,
          balance: 85,
          toolId: "thumb",
          tool: null,
          createdAt: new Date(t0.getTime() - 60_000),
        },
      ]);
      prismaMock.aIRequestLog.findMany.mockResolvedValue([
        {
          model: "flux-pro",
          toolId: "thumb",
          createdAt: new Date(t0.getTime() + 5_000),
        },
        { model: "other-tool-model", toolId: "video", createdAt: t0 },
      ]);

      const result = await controller.getTransactions("u1");

      expect(result[0]).toMatchObject({
        id: "tx1",
        toolName: "Thumbnails",
        toolIcon: "🖼",
        model: "flux-pro",
      });
      // 65s away from the only matching log → no model; falls back to toolId.
      expect(result[1]).toMatchObject({
        id: "tx2",
        toolName: "thumb",
        toolIcon: null,
        model: null,
      });
      expect(
        prismaMock.creditTransaction.findMany.mock.calls[0]![0],
      ).toMatchObject({
        where: { userId: "u1" },
        take: 50,
      });
      expect(prismaMock.aIRequestLog.findMany.mock.calls[0]![0].where).toEqual({
        userId: "u1",
      });
    });
  });

  describe("checkout", () => {
    it("charges the server-side plan price, not a client-provided amount", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue({
        id: "plan-1",
        slug: "STARTER",
        name: "Starter",
        usdAmount: 9.99,
        creditsGiven: 1000,
      });

      const result = await controller.checkout("u1", "plan-1");

      expect(paymentRegistry.getGateway).toHaveBeenCalledWith(
        PaymentGateway.MERCADO_PAGO,
      );
      expect(gateway.createCheckoutSession).toHaveBeenCalledWith({
        userId: "u1",
        amount: 9.99,
        currency: "USD",
        creditsToBuy: 1000,
        description: "1000 credits - Starter",
        planSlug: "STARTER",
      });
      expect(result).toEqual({
        redirectUrl: "https://pay.example/checkout",
        gatewayTxId: "tx-1",
        preferenceId: "pref-1",
      });
    });

    it("uses PayPal only when explicitly requested", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue({
        slug: "PRO",
        name: "Pro",
        usdAmount: 20,
        creditsGiven: 2500,
      });

      await controller.checkout("u1", "plan-2", "PAYPAL");

      expect(paymentRegistry.getGateway).toHaveBeenCalledWith(
        PaymentGateway.PAYPAL,
      );
    });

    it("rejects an unknown plan before contacting a gateway", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue(null);

      await expect(controller.checkout("u1", "nope")).rejects.toThrow(
        "Plan not found",
      );
      expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
    });
  });

  describe("customCheckout", () => {
    it.each([undefined, 0, 9.99])(
      "rejects amounts below $10 (%s)",
      async (amount) => {
        await expect(
          controller.customCheckout("u1", amount as never),
        ).rejects.toThrow("Minimum amount is $10");
        expect(gateway.createCheckoutSession).not.toHaveBeenCalled();
      },
    );

    it("converts dollars to credits using the PAY_AS_YOU_GO plan rate (rounded down)", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue({
        usdAmount: 10,
        creditsGiven: 1050,
      });

      await controller.customCheckout("u1", 15.5);

      expect(prismaMock.creditPlan.findUnique).toHaveBeenCalledWith({
        where: { slug: "PAY_AS_YOU_GO" },
      });
      expect(gateway.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15.5,
          creditsToBuy: 1627, // floor(15.5 / 10 * 1050)
          planSlug: "PAY_AS_YOU_GO",
        }),
      );
    });

    it("falls back to 100 credits per dollar without a PAYG plan", async () => {
      prismaMock.creditPlan.findUnique.mockResolvedValue(null);

      await controller.customCheckout("u1", 12);

      expect(gateway.createCheckoutSession.mock.calls[0]![0].creditsToBuy).toBe(
        1200,
      );
    });
  });

  describe("status", () => {
    it("only looks up transactions owned by the current user", async () => {
      prismaMock.creditTransaction.findFirst.mockResolvedValue(null);

      expect(await controller.status("u1", "tx-of-someone-else")).toEqual({
        status: "UNKNOWN",
      });
      expect(prismaMock.creditTransaction.findFirst).toHaveBeenCalledWith({
        where: { referenceId: "tx-of-someone-else", userId: "u1" },
      });
    });

    it.each([
      ["Payment pending approval", "PENDING"],
      ["Purchased 1000 credits", "COMPLETED"],
    ])("maps %j to %s", async (description, status) => {
      const createdAt = new Date();
      prismaMock.creditTransaction.findFirst.mockResolvedValue({
        id: "t1",
        amount: 1000,
        balance: 1100,
        description,
        createdAt,
        userId: "u1",
      });

      expect(await controller.status("u1", "tx-1")).toEqual({
        status,
        transaction: { id: "t1", amount: 1000, balance: 1100, createdAt },
      });
    });
  });

  it("returns the 10 most recent marketing events", async () => {
    const createdAt = new Date();
    prismaMock.marketingEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        type: "SIGNUP_BONUS",
        credits: 100,
        metadata: null,
        createdAt,
        userId: "u1",
      },
    ]);

    expect(await controller.getMarketingEvents("u1")).toEqual([
      {
        id: "e1",
        type: "SIGNUP_BONUS",
        credits: 100,
        metadata: null,
        createdAt,
      },
    ]);
    expect(prismaMock.marketingEvent.findMany.mock.calls[0]![0]).toMatchObject({
      where: { userId: "u1" },
      take: 10,
    });
  });

  it("delegates plans and subscriptions to the billing service", async () => {
    await controller.getPlans();
    await controller.subscribe("u1", "plan-1");

    expect(billingService.getPlans).toHaveBeenCalled();
    expect(billingService.subscribe).toHaveBeenCalledWith("u1", "plan-1");
  });
});
