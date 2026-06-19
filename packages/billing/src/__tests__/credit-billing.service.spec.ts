import { CreditBillingService } from "../services/credit-billing.service";
import { prisma } from "@creator-hub/database";
import { PaymentGateway } from "../interfaces/payment-gateway.interface";

vi.mock("@creator-hub/database", () => ({
  prisma: {
    creditTransaction: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    creditPlan: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
  },
}));

// We'll inject a mock event publisher instance directly into the service below.

describe("CreditBillingService (notifications)", () => {
  let service: CreditBillingService;
  const mockCreditService = {
    addCredits: vi.fn().mockResolvedValue(undefined),
    getBalance: vi.fn().mockResolvedValue(0),
  } as any;

  let mockEventPublisher: { publish: jest.Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    } as any;
    service = new CreditBillingService(
      mockCreditService as any,
      mockEventPublisher as any,
    );
  });

  it("returns false when verification is invalid", async () => {
    const result = await service.reconcilePayment(
      PaymentGateway.MERCADO_PAGO as any,
      { isValid: false, status: "FAILED", gatewayTxId: "x" } as any,
      {},
    );

    expect(result).toBe(false);
    expect(mockEventPublisher.publish).not.toHaveBeenCalled();
  });

  describe("idempotency - duplicate purchase protection", () => {
    it("returns true and does not add credits when transaction already exists", async () => {
      (prisma.creditTransaction.findFirst as jest.Mock).mockResolvedValue({
        id: "txn-exists",
        referenceId: "mp_duplicate_1",
        amount: 500,
        userId: "user-1",
      });

      const res = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_duplicate_1",
        } as any,
        { external_reference: "user-1", amount: 50 },
      );

      expect(res).toBe(true);
      // addCredits should NOT be called for duplicate
      expect(mockCreditService.addCredits).not.toHaveBeenCalled();
      // No event should be emitted
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();
    });

    it("does not duplicate credits when same webhook arrives twice rapidly", async () => {
      // First call: no existing transaction
      (prisma.creditTransaction.findFirst as jest.Mock)
        .mockResolvedValueOnce(null) // First webhook check
        .mockResolvedValueOnce({ id: "txn-created" }); // Second webhook check finds the record
      (prisma.creditPlan.findUnique as jest.Mock).mockResolvedValue({
        slug: "PAY_AS_YOU_GO",
        usdAmount: 10.0,
        creditsGiven: 1000,
      });
      (mockCreditService.getBalance as jest.Mock).mockResolvedValue(1000);

      // First webhook
      const res1 = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_rapid_1",
        } as any,
        { external_reference: "user-1", amount: 100 },
      );

      // Second webhook (duplicate)
      const res2 = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_rapid_1",
        } as any,
        { external_reference: "user-1", amount: 100 },
      );

      expect(res1).toBe(true);
      expect(res2).toBe(true);
      // addCredits should only be called ONCE
      expect(mockCreditService.addCredits).toHaveBeenCalledTimes(1);
      // Event should only be emitted ONCE
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
    });

    it("does not add credits when same payment webhook arrives 3 times", async () => {
      (prisma.creditTransaction.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "txn-1" })
        .mockResolvedValueOnce({ id: "txn-1" });
      (prisma.creditPlan.findUnique as jest.Mock).mockResolvedValue({
        slug: "PAY_AS_YOU_GO",
        usdAmount: 10.0,
        creditsGiven: 1000,
      });
      (mockCreditService.getBalance as jest.Mock).mockResolvedValue(500);

      await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_triple",
        } as any,
        { external_reference: "user-2", amount: 50 },
      );
      await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_triple",
        } as any,
        { external_reference: "user-2", amount: 50 },
      );
      await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_triple",
        } as any,
        { external_reference: "user-2", amount: 50 },
      );

      expect(mockCreditService.addCredits).toHaveBeenCalledTimes(1);
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(1);
    });
  });

  describe("payment status handling", () => {
    it("returns true and does not add credits when status is PENDING", async () => {
      const res = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        {
          isValid: true,
          status: "PENDING",
          gatewayTxId: "mp_pending_1",
        } as any,
        { external_reference: "user-pending" },
      );

      expect(res).toBe(true);
      expect(mockCreditService.addCredits).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        "payment:pending",
        expect.objectContaining({
          userId: "user-pending",
          gatewayTxId: "mp_pending_1",
        }),
      );
    });

    it("returns false and does not add credits when status is FAILED", async () => {
      const res = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        { isValid: true, status: "FAILED", gatewayTxId: "mp_failed_1" } as any,
        { external_reference: "user-failed" },
      );

      expect(res).toBe(false);
      expect(mockCreditService.addCredits).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        "payment:failed",
        expect.objectContaining({
          userId: "user-failed",
          gatewayTxId: "mp_failed_1",
        }),
      );
    });

    it("adds credits and emits success when status is SUCCESSFUL", async () => {
      (prisma.creditTransaction.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.creditPlan.findUnique as jest.Mock).mockResolvedValue({
        slug: "PAY_AS_YOU_GO",
        usdAmount: 10.0,
        creditsGiven: 1000,
      });
      (mockCreditService.getBalance as jest.Mock).mockResolvedValue(200);

      const res = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        { isValid: true, status: "SUCCESSFUL", gatewayTxId: "mp_ok_1" } as any,
        { external_reference: "user-ok", amount: 120 },
      );

      expect(res).toBe(true);
      expect(mockCreditService.addCredits).toHaveBeenCalledWith(
        "user-ok",
        12000,
        "Payment MERCADO_PAGO - mp_ok_1",
        "PURCHASE",
        { provider: "MERCADO_PAGO", referenceId: "mp_ok_1" },
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        "payment:success",
        expect.objectContaining({
          userId: "user-ok",
          gatewayTxId: "mp_ok_1",
          amount: 12000,
        }),
      );
    });
  });

  describe("PENDING status with API fetch for userId", () => {
    it("does not fetch from API when userId is in raw body", async () => {
      const spy = vi
        .spyOn(service as any, "getMercadoPagoClient")
        .mockReturnValue(null);

      const res = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        { isValid: true, status: "PENDING", gatewayTxId: "mp_fetch_1" } as any,
        { external_reference: "user-from-raw" },
      );

      expect(res).toBe(true);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        "payment:pending",
        expect.objectContaining({
          userId: "user-from-raw",
          gatewayTxId: "mp_fetch_1",
        }),
      );

      spy.mockRestore();
    });

    it("does not emit pending event when userId cannot be determined", async () => {
      const spy = vi
        .spyOn(service as any, "getMercadoPagoClient")
        .mockReturnValue(null);

      const res = await service.reconcilePayment(
        PaymentGateway.MERCADO_PAGO as any,
        { isValid: true, status: "PENDING", gatewayTxId: "mp_no_user" } as any,
        {},
      );

      expect(res).toBe(true);
      // No event emitted since userId is unknown
      expect(mockEventPublisher.publish).not.toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  it("creates transaction and emits payment:success on successful reconciliation", async () => {
    (prisma.creditTransaction.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.creditPlan.findUnique as jest.Mock).mockResolvedValue({
      slug: "PAY_AS_YOU_GO",
      usdAmount: 10.0,
      creditsGiven: 1000,
    });
    (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({
      id: "txn-123",
    });
    (mockCreditService.getBalance as jest.Mock).mockResolvedValue(200);

    const res = await service.reconcilePayment(
      PaymentGateway.MERCADO_PAGO as any,
      { isValid: true, status: "SUCCESSFUL", gatewayTxId: "mp_abc" } as any,
      { external_reference: "user-42", amount: 120 },
    );

    expect(res).toBe(true);

    // Domain event publisher should have been called
    expect(mockEventPublisher.publish).toHaveBeenCalledWith("payment:success", {
      userId: "user-42",
      gatewayTxId: "mp_abc",
      amount: 12000, // 120 / 10 * 1000 = 12000 credits
      balance: 200,
      gateway: PaymentGateway.MERCADO_PAGO,
      timestamp: expect.any(Date),
    });
  });
});
