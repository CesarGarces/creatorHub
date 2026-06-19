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
    it("should return combined balance when user exists", async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        freeCredits: 50,
        purchasedCredits: 100,
      });

      const balance = await service.getBalance("user-1");

      expect(balance).toBe(150);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: { freeCredits: true, purchasedCredits: true },
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
        freeCredits: 50,
        purchasedCredits: 50,
      });

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(true);
    });

    it("should return false when balance is insufficient", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        freeCredits: 5,
        purchasedCredits: 5,
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
    it("should deduct credits successfully using freeCredits first", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: "user-1",
          freeCredits: 80,
          purchasedCredits: 20,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          freeCredits: 70,
          purchasedCredits: 20,
        });
      (prisma.tool.findUnique as any).mockResolvedValue({ id: "tool-1" });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      const result = await service.deduct("user-1", 10, "tool-1", "Test usage");

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          freeCredits: { decrement: 10 },
          purchasedCredits: { decrement: 0 },
        },
      });
    });

    it("should split deduction across free and purchased credits", async () => {
      (prisma.user.findUnique as any)
        .mockResolvedValueOnce({
          id: "user-1",
          freeCredits: 5,
          purchasedCredits: 20,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          freeCredits: 0,
          purchasedCredits: 15,
        });
      (prisma.tool.findUnique as any).mockResolvedValue(null);
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      const result = await service.deduct("user-1", 10);

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          freeCredits: { decrement: 5 },
          purchasedCredits: { decrement: 5 },
        },
      });
    });

    it("should return false and queue credit-depleted when balance is insufficient", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        freeCredits: 3,
        purchasedCredits: 2,
      });

      const result = await service.deduct("user-1", 10);

      expect(result).toBe(false);
      expect(mockQueue.add).toHaveBeenCalledWith("credit-depleted", {
        userId: "user-1",
        balance: 5,
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
          freeCredits: 80,
          purchasedCredits: 20,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          freeCredits: 70,
          purchasedCredits: 20,
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
          freeCredits: 80,
          purchasedCredits: 20,
        })
        .mockResolvedValueOnce({
          id: "user-1",
          freeCredits: 70,
          purchasedCredits: 20,
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
    it("should add purchased credits and create transaction", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        freeCredits: 100,
        purchasedCredits: 200,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits("user-1", 100, "Purchase", "PURCHASE");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          purchasedCredits: { increment: 100 },
        },
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          amount: 100,
          type: "PURCHASE",
          description: "Purchase",
          balance: 300,
        },
      });
    });

    it("should add free credits for non-PURCHASE types", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        freeCredits: 150,
        purchasedCredits: 0,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits("user-1", 50, "Bonus credits");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          freeCredits: { increment: 50 },
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
      // After increment: 100 + 200 + 500 = 800
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        freeCredits: 100,
        purchasedCredits: 700,
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
          balance: 800,
          provider: "MERCADO_PAGO",
          referenceId: "mp_test_123",
        },
      });
    });

    it("should not include provider/referenceId when options not provided", async () => {
      (prisma.user.update as any).mockResolvedValue({});
      // After increment: 100 + 200 + 100 = 400
      (prisma.user.findUnique as any).mockResolvedValue({
        id: "user-1",
        freeCredits: 200,
        purchasedCredits: 200,
      });
      (prisma.creditTransaction.create as any).mockResolvedValue({});

      await service.addCredits("user-1", 100, "Bonus", "BONUS");

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          amount: 100,
          type: "BONUS",
          description: "Bonus",
          balance: 400,
        },
      });
    });
  });
});
