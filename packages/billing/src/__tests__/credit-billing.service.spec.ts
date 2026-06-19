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

  it("returns true and does not emit when transaction already exists", async () => {
    (prisma.creditTransaction.findFirst as jest.Mock).mockResolvedValue({
      id: "txn-exists",
    });

    const res = await service.reconcilePayment(
      PaymentGateway.MERCADO_PAGO as any,
      { isValid: true, status: "SUCCESSFUL", gatewayTxId: "mp_1" } as any,
      { external_reference: "user-1", amount: 50 },
    );

    expect(res).toBe(true);
    expect(mockEventPublisher.publish).not.toHaveBeenCalled();
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
