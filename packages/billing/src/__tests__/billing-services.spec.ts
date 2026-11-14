import {
  Logger,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma } from "@creator-hub/database";

const db = vi.hoisted(() => ({
  creditPlan: { findMany: vi.fn(), findUnique: vi.fn() },
  subscriptionPlan: { findUnique: vi.fn() },
  subscription: { create: vi.fn(), updateMany: vi.fn() },
  user: { update: vi.fn(), findUnique: vi.fn() },
  marketingEvent: { create: vi.fn() },
  notification: { create: vi.fn() },
  creditTransaction: { findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

const mp = vi.hoisted(() => ({
  preferenceCreate: vi.fn(),
  paymentGet: vi.fn(),
}));

vi.mock("@creator-hub/database", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  prisma: db,
}));

vi.mock("mercadopago", () => ({
  MercadoPagoConfig: class {
    constructor(public options: unknown) {}
  },
  Preference: class {
    create = mp.preferenceCreate;
  },
  Payment: class {
    get = mp.paymentGet;
  },
}));

import { BillingService } from "../billing.service";
import { CreditProcessor } from "../credit.processor";
import { MarketingEventHandler } from "../marketing-event.handler";
import { PaymentRegistryService } from "../services/payment-registry.service";
import { CreditBillingService } from "../services/credit-billing.service";
import { MercadoPagoStrategy } from "../strategies/mercado-pago.strategy";
import { PaymentGateway } from "../interfaces/payment-gateway.interface";

const ENV = [
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MP_ACCESS_TOKEN",
  "NODE_ENV",
  "MP_NOTIFICATION_URL",
  "API_URL",
  "FRONTEND_URL",
];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  for (const key of ENV) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(Logger.prototype, level).mockImplementation(() => {});
  }
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  for (const key of ENV) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe("BillingService", () => {
  const service = new BillingService();

  it("lists active credit plans in display order", async () => {
    db.creditPlan.findMany.mockResolvedValue([{ slug: "STARTER" }]);

    await expect(service.getPlans()).resolves.toEqual([{ slug: "STARTER" }]);
    expect(db.creditPlan.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { usdAmount: "asc" }],
    });
  });

  it("rejects unknown subscription plans", async () => {
    db.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(service.subscribe("u1", "platinum")).rejects.toThrow(
      "Plan not found",
    );
    expect(db.subscription.create).not.toHaveBeenCalled();
  });

  it("cancels at the end of the period instead of immediately", async () => {
    await service.cancelSubscription("u1");

    expect(db.subscription.updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", status: "ACTIVE" },
      data: { cancelAtPeriodEnd: true },
    });
  });
});

describe("CreditProcessor", () => {
  const processor = new CreditProcessor();

  it.each(["credit-depleted", "credit-expiring", "something-else"])(
    "handles %s jobs without throwing",
    async (name) => {
      await expect(
        processor.process({
          name,
          data: { userId: "u1", balance: 0 },
        } as never),
      ).resolves.toBeUndefined();
    },
  );
});

describe("MarketingEventHandler", () => {
  const eventPublisher = { publish: vi.fn() };
  const handler = new MarketingEventHandler(eventPublisher as never);

  beforeEach(() => {
    db.marketingEvent.create.mockResolvedValue({ id: "me1" });
  });

  it("records credit-threshold marketing events", async () => {
    await handler.handleCreditThreshold({
      userId: "u1",
      threshold: 20,
      creditsRemaining: 18,
      timestamp: new Date(),
    });

    expect(db.marketingEvent.create).toHaveBeenCalledWith({
      data: {
        userId: "u1",
        type: "CREDIT_THRESHOLD_20",
        credits: 18,
        metadata: {
          triggeredAt: expect.any(String),
          source: "credit-deduction",
        },
      },
    });
  });

  it("records depletion and sends an upgrade notification", async () => {
    await handler.handleCreditDepleted({ userId: "u1", timestamp: new Date() });

    expect(db.marketingEvent.create.mock.calls[0]![0].data).toMatchObject({
      type: "CREDIT_DEPLETED",
      credits: 0,
    });
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "u1",
        type: "CREDIT_LOW",
        data: { action: "upgrade", url: "/pricing" },
      }),
    });
  });
});

describe("PaymentRegistryService", () => {
  const mercadoPago = { getGatewayType: () => PaymentGateway.MERCADO_PAGO };

  it("returns registered gateways by type", () => {
    const registry = new PaymentRegistryService([mercadoPago as never]);

    expect(registry.getGateway(PaymentGateway.MERCADO_PAGO)).toBe(mercadoPago);
    expect(registry.listSupported()).toEqual([PaymentGateway.MERCADO_PAGO]);
  });

  it("rejects unsupported gateways with a 400", () => {
    const registry = new PaymentRegistryService([mercadoPago as never]);
    expect(() => registry.getGateway(PaymentGateway.PAYPAL)).toThrow(
      BadRequestException,
    );
  });

  it("tolerates a missing strategy list", () => {
    expect(
      new PaymentRegistryService(undefined as never).listSupported(),
    ).toEqual([]);
  });
});

describe("MercadoPagoStrategy.createCheckoutSession", () => {
  const strategy = new MercadoPagoStrategy();
  const checkout = {
    userId: "u1",
    amount: 25,
    currency: "USD" as const,
    creditsToBuy: 2700,
    description: "2700 credits - Starter",
    planSlug: "STARTER",
  };

  it("identifies itself as Mercado Pago", () => {
    expect(strategy.getGatewayType()).toBe(PaymentGateway.MERCADO_PAGO);
  });

  it("creates a preference that records the user, credits and plan", async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-x";
    process.env.API_URL = "https://api.creatorhub.com/";
    process.env.FRONTEND_URL = "https://app.creatorhub.com";
    mp.preferenceCreate.mockResolvedValue({
      id: "pref-1",
      init_point: "https://mp/checkout/pref-1",
    });

    const result = await strategy.createCheckoutSession(checkout);

    expect(result).toEqual({
      paymentUrl: "https://mp/checkout/pref-1",
      gatewayTxId: "pref-1",
      preferenceId: "pref-1",
    });
    const { body } = mp.preferenceCreate.mock.calls[0]![0];
    expect(body.items).toEqual([
      {
        id: "credits_2700",
        title: "2700 credits - Starter",
        quantity: 1,
        currency_id: "USD",
        unit_price: 25,
      },
    ]);
    expect(body.external_reference).toBe("u1");
    expect(body.metadata).toEqual({
      user_id: "u1",
      credits: 2700,
      plan_slug: "STARTER",
    });
    expect(body.notification_url).toBe(
      "https://api.creatorhub.com/api/v1/webhooks/mercado-pago",
    );
    expect(body.back_urls.success).toBe("https://app.creatorhub.com/credits");
  });

  it("prefers an explicit notification URL", async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-x";
    process.env.MP_NOTIFICATION_URL = "https://hooks.example.com/mp";
    mp.preferenceCreate.mockResolvedValue({
      id: "pref-2",
      sandbox_init_point: "https://sandbox/2",
    });

    const result = await strategy.createCheckoutSession(checkout);

    expect(mp.preferenceCreate.mock.calls[0]![0].body.notification_url).toBe(
      "https://hooks.example.com/mp",
    );
    expect(result.paymentUrl).toBe("https://sandbox/2");
  });

  it("refuses to create fake checkouts in production without a token", async () => {
    process.env.NODE_ENV = "production";
    await expect(strategy.createCheckoutSession(checkout)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it("returns a stub checkout URL in development without a token", async () => {
    process.env.NODE_ENV = "development";

    const result = await strategy.createCheckoutSession(checkout);

    expect(result.gatewayTxId).toMatch(/^mp_pref_[0-9a-f-]{36}$/);
    expect(result.paymentUrl).toContain(result.gatewayTxId);
    expect(mp.preferenceCreate).not.toHaveBeenCalled();
  });

  it("surfaces SDK failures as 503 in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-x";
    mp.preferenceCreate.mockRejectedValue(new Error("invalid token"));

    await expect(strategy.createCheckoutSession(checkout)).rejects.toThrow(
      "Could not create Mercado Pago preference",
    );
  });
});

describe("MercadoPagoStrategy.verifyWebhook payment id extraction", () => {
  const strategy = new MercadoPagoStrategy();

  beforeEach(() => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-x";
    mp.paymentGet.mockResolvedValue({ status: "approved" });
  });

  it.each([
    ["new format", { data: { id: 111 } }, "111"],
    ["legacy IPN", { topic: "payment", resource: "222" }, "222"],
    [
      "resource URL",
      { resource: "https://api.mercadolibre.com/payments/333?x=1" },
      "333",
    ],
    ["numeric id field", { id: "444" }, "444"],
    ["payment_id field", { payment_id: 555 }, "555"],
  ])("reads the payment id from the %s", async (_label, body, id) => {
    const result = await strategy.verifyWebhook({}, body);

    expect(result.gatewayTxId).toBe(id);
    expect(mp.paymentGet).toHaveBeenCalledWith({ id });
  });
});

describe("CreditBillingService", () => {
  const creditService = { getBalance: vi.fn() };
  const publisher = { publish: vi.fn() };
  const service = new CreditBillingService(
    creditService as never,
    publisher as never,
  );
  const verified = {
    isValid: true,
    gatewayTxId: "pay-1",
    status: "SUCCESSFUL" as const,
  };

  beforeEach(() => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "APP_USR-x";
    db.creditTransaction.findFirst.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue({ currentCredits: 2800 });
    creditService.getBalance.mockResolvedValue(2800);
  });

  it("grants the credits recorded at checkout and upgrades the plan", async () => {
    mp.paymentGet.mockResolvedValue({
      external_reference: "u1",
      transaction_amount: 25,
      metadata: { credits: 2700, plan_slug: "STARTER" },
    });

    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).resolves.toBe(true);

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        currentCredits: { increment: 2700 },
        purchasedCredits: { increment: 2700 },
        plan: "STARTER",
      },
    });
    expect(db.creditTransaction.create.mock.calls[0]![0].data).toMatchObject({
      userId: "u1",
      amount: 2700,
      type: "PURCHASE",
      referenceId: "pay-1",
      balance: 2800,
    });
    expect(publisher.publish).toHaveBeenCalledWith(
      "payment:success",
      expect.objectContaining({ userId: "u1", amount: 2700, balance: 2800 }),
    );
  });

  it("ignores unknown plan slugs in metadata", async () => {
    mp.paymentGet.mockResolvedValue({
      external_reference: "u1",
      transaction_amount: 5,
      metadata: { credits: 50, plan_slug: "ENTERPRISE" },
    });

    await service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {});

    expect(db.user.update.mock.calls[0]![0].data.plan).toBeUndefined();
  });

  it("falls back to the pay-as-you-go rate when metadata has no credits", async () => {
    mp.paymentGet.mockResolvedValue({
      external_reference: "u1",
      transaction_amount: 15,
      metadata: {},
    });
    db.creditPlan.findUnique.mockResolvedValue({
      usdAmount: 10,
      creditsGiven: 1000,
    });

    await service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {});

    expect(db.user.update.mock.calls[0]![0].data.currentCredits).toEqual({
      increment: 1500,
    });
  });

  it("does not grant credits when the payer cannot be identified", async () => {
    mp.paymentGet.mockResolvedValue({
      transaction_amount: 25,
      metadata: { credits: 100 },
    });

    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).resolves.toBe(false);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("does not grant credits for a zero amount", async () => {
    mp.paymentGet.mockResolvedValue({
      external_reference: "u1",
      transaction_amount: 0,
    });

    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).resolves.toBe(false);
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("treats a concurrent duplicate (unique referenceId violation) as already processed", async () => {
    db.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ['"referenceId"'] },
      }),
    );

    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).resolves.toBe(true);
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it("rethrows other unique violations and database errors", async () => {
    db.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["email"] },
      }),
    );
    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).rejects.toThrow("Unique constraint failed");

    db.$transaction.mockRejectedValueOnce(new Error("connection lost"));
    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).rejects.toThrow("connection lost");
  });

  it("still succeeds when the success notification cannot be published", async () => {
    mp.paymentGet.mockResolvedValue({
      external_reference: "u1",
      transaction_amount: 1,
      metadata: { credits: 100 },
    });
    publisher.publish.mockRejectedValue(new Error("redis down"));

    await expect(
      service.reconcilePayment(PaymentGateway.MERCADO_PAGO, verified, {}),
    ).resolves.toBe(true);
  });

  it("re-checks PENDING payments and notifies about genuinely pending ones", async () => {
    mp.paymentGet.mockResolvedValue({
      status: "in_process",
      external_reference: "u1",
    });

    const result = await service.reconcilePayment(
      PaymentGateway.MERCADO_PAGO,
      { ...verified, status: "PENDING" },
      {},
    );

    expect(result).toBe(true);
    expect(publisher.publish).toHaveBeenCalledWith(
      "payment:pending",
      expect.objectContaining({
        userId: "u1",
        reason: "Payment status: in_process",
      }),
    );
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("fails PENDING payments that the API reports as rejected", async () => {
    mp.paymentGet.mockResolvedValue({
      status: "rejected",
      external_reference: "u1",
    });

    const result = await service.reconcilePayment(
      PaymentGateway.MERCADO_PAGO,
      { ...verified, status: "PENDING" },
      {},
    );

    expect(result).toBe(false);
    expect(publisher.publish).toHaveBeenCalledWith(
      "payment:failed",
      expect.objectContaining({
        userId: "u1",
        reason: "Payment status: rejected",
      }),
    );
  });
});
