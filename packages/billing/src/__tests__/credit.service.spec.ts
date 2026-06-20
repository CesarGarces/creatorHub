import { CreditService } from "../credit.service";
import { prisma } from "@creator-hub/database";

vi.mock("@creator-hub/database", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
    tool: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
  },
}));

vi.mock("@creator-hub/shared-utils", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe("CreditService", () => {
  let service: CreditService;
  const mockQueue = {
    add: vi.fn().mockResolvedValue({}),
  };
  const mockEventEmitter = {
    emit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CreditService(mockQueue as any, mockEventEmitter as any);
  });

  describe("getBalance", () => {
    it("should return currentCredits as balance", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        currentCredits: 150,
      });

      const balance = await service.getBalance("user-1");

      expect(balance).toBe(150);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { currentCredits: true },
      });
    });

    it("should return 0 when user has no balance record", async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const balance = await service.getBalance("user-999");

      expect(balance).toBe(0);
    });
  });

  describe("hasEnoughCredits", () => {
    it("should return true when balance is sufficient", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        currentCredits: 100,
      });

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(true);
    });

    it("should return false when balance is insufficient", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        currentCredits: 5,
      });

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(false);
    });

    it("should return false when user has no balance", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(false);
    });
  });

  describe("deduct", () => {
    it("should deduct credits from currentCredits", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: "user-1",
          currentCredits: 80,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          currentCredits: 70,
        });
      (prisma.tool.findUnique as any).mockResolvedValue({ id: "tool-1" });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      const result = await service.deduct("user-1", 10, "tool-1", "Test usage");

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          currentCredits: { decrement: 10 },
        },
      });
    });

    it("should return false and queue credit-depleted when balance is insufficient", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        currentCredits: 3,
      });

      const result = await service.deduct("user-1", 10);

      expect(result).toBe(false);
      expect(mockQueue.add).toHaveBeenCalledWith("credit-depleted", {
        userId: "user-1",
        balance: 3,
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        "marketing.credit_depleted",
        {
          userId: "user-1",
          timestamp: expect.any(Date),
        },
      );
    });

    it("should return false when user does not exist", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.deduct("user-1", 10);

      expect(result).toBe(false);
    });

    it("should validate toolId exists before deducting", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: "user-1",
          currentCredits: 80,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          currentCredits: 70,
        });
      (prisma.tool.findUnique as any).mockResolvedValue({ id: "tool-1" });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.deduct("user-1", 10, "tool-1");

      expect(prisma.tool.findUnique).toHaveBeenCalledWith({
        where: { id: "tool-1" },
      });
    });

    it("should set toolId to null when tool does not exist", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: "user-1",
          currentCredits: 80,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          currentCredits: 70,
        });
      (prisma.tool.findUnique as any).mockResolvedValue(null);
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.deduct("user-1", 10, "nonexistent-tool");

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toolId: null,
        }),
      });
    });
  });

  describe("addCredits", () => {
    it("should add to currentCredits for PURCHASE type and also increment purchasedCredits", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        currentCredits: 200,
        purchasedCredits: 100,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits("user-1", 100, "Purchase", "PURCHASE");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          currentCredits: { increment: 100 },
          purchasedCredits: { increment: 100 },
        },
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          amount: 100,
          type: "PURCHASE",
          description: "Purchase",
          balance: 200,
        },
      });
    });

    it("should add to currentCredits for non-PURCHASE types", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        currentCredits: 150,
        purchasedCredits: 0,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits("user-1", 50, "Bonus credits");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          currentCredits: { increment: 50 },
        },
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "BONUS",
        }),
      });
    });

    it("should include provider and referenceId when options provided", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        currentCredits: 600,
        purchasedCredits: 500,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits(
        "user-1",
        500,
        "Payment MERCADO_PAGO - mp_test_123",
        "PURCHASE",
        { provider: "MERCADO_PAGO", referenceId: "mp_test_123" },
      );

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          amount: 500,
          type: "PURCHASE",
          description: "Payment MERCADO_PAGO - mp_test_123",
          balance: 600,
          provider: "MERCADO_PAGO",
          referenceId: "mp_test_123",
        },
      });
    });

    it("should not include provider/referenceId when options not provided", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        currentCredits: 300,
        purchasedCredits: 0,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits("user-1", 100, "Bonus", "BONUS");

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          amount: 100,
          type: "BONUS",
          description: "Bonus",
          balance: 300,
        },
      });
    });
  });
});
