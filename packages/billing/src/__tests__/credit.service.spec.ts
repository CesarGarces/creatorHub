import { CreditService } from "../credit.service";
import { prisma } from "@creator-hub/database";

jest.mock("@creator-hub/database", () => ({
  prisma: {
    creditBalance: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
    },
    tool: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
  },
}));

jest.mock("@creator-hub/shared-utils", () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("CreditService", () => {
  let service: CreditService;
  const mockQueue = {
    add: jest.fn().mockResolvedValue({}),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CreditService(mockQueue as any);
  });

  describe("getBalance", () => {
    it("should return balance when user has credit record", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-1",
        balance: 500,
        lifetime: 1000,
      });

      const balance = await service.getBalance("user-1");

      expect(balance).toBe(500);
      expect(prisma.creditBalance.findUnique).toHaveBeenCalledWith({
        where: { userId: "user-1" },
      });
    });

    it("should return 0 when user has no credit record", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue(null);

      const balance = await service.getBalance("user-999");

      expect(balance).toBe(0);
    });
  });

  describe("hasEnoughCredits", () => {
    it("should return true when balance is sufficient", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-1",
        balance: 100,
      });

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(true);
    });

    it("should return false when balance is insufficient", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-1",
        balance: 10,
      });

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(false);
    });

    it("should return false when user has no balance", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.hasEnoughCredits("user-1", 50);

      expect(result).toBe(false);
    });
  });

  describe("deduct", () => {
    it("should deduct credits successfully", async () => {
      (prisma.creditBalance.findUnique as jest.Mock)
        .mockResolvedValueOnce({ userId: "user-1", balance: 100 })
        .mockResolvedValueOnce({ userId: "user-1", balance: 90 });
      (prisma.tool.findUnique as jest.Mock).mockResolvedValue({ id: "tool-1" });
      (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.deduct("user-1", 10, "tool-1", "Test usage");

      expect(result).toBe(true);
      expect(prisma.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { balance: { decrement: 10 } },
      });
      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          amount: -10,
          type: "USAGE",
          description: "Test usage",
          toolId: "tool-1",
          balance: 90,
        },
      });
    });

    it("should return false and queue credit-depleted when balance is insufficient", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue({
        userId: "user-1",
        balance: 5,
      });

      const result = await service.deduct("user-1", 10);

      expect(result).toBe(false);
      expect(mockQueue.add).toHaveBeenCalledWith("credit-depleted", {
        userId: "user-1",
        balance: 5,
      });
      expect(prisma.creditBalance.update).not.toHaveBeenCalled();
    });

    it("should return false when user has no balance record", async () => {
      (prisma.creditBalance.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.deduct("user-1", 10);

      expect(result).toBe(false);
      expect(mockQueue.add).toHaveBeenCalledWith("credit-depleted", {
        userId: "user-1",
        balance: 0,
      });
    });

    it("should validate toolId exists before deducting", async () => {
      (prisma.creditBalance.findUnique as jest.Mock)
        .mockResolvedValueOnce({ userId: "user-1", balance: 100 })
        .mockResolvedValueOnce({ userId: "user-1", balance: 90 });
      (prisma.tool.findUnique as jest.Mock).mockResolvedValue({ id: "tool-1" });
      (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({});

      await service.deduct("user-1", 10, "tool-1");

      expect(prisma.tool.findUnique).toHaveBeenCalledWith({
        where: { id: "tool-1" },
      });
    });

    it("should set toolId to null when tool does not exist", async () => {
      (prisma.creditBalance.findUnique as jest.Mock)
        .mockResolvedValueOnce({ userId: "user-1", balance: 100 })
        .mockResolvedValueOnce({ userId: "user-1", balance: 90 });
      (prisma.tool.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({});

      await service.deduct("user-1", 10, "nonexistent-tool");

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          toolId: null,
        }),
      });
    });
  });

  describe("addCredits", () => {
    it("should add credits and create transaction", async () => {
      (prisma.creditBalance.update as jest.Mock).mockResolvedValue({
        userId: "user-1",
        balance: 200,
        lifetime: 1100,
      });
      (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({});

      await service.addCredits("user-1", 100, "Purchase", "PURCHASE");

      expect(prisma.creditBalance.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: {
          balance: { increment: 100 },
          lifetime: { increment: 100 },
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

    it("should default to BONUS type when type not specified", async () => {
      (prisma.creditBalance.update as jest.Mock).mockResolvedValue({
        userId: "user-1",
        balance: 150,
      });
      (prisma.creditTransaction.create as jest.Mock).mockResolvedValue({});

      await service.addCredits("user-1", 50, "Bonus credits");

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "BONUS",
        }),
      });
    });
  });
});
