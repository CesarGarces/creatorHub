import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { prisma } from "@creator-hub/database";

jest.mock("@creator-hub/database", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    account: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => fn(prisma)),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("$2a$12$hashedpassword"),
  compare: jest.fn(),
}));

describe("AuthService", () => {
  let service: AuthService;
  const mockJwtService = {
    sign: jest.fn().mockReturnValue("mock-jwt-token"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(mockJwtService as any);
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
      });

      const result = await service.register("test@example.com", "password123", "Test User");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user).toEqual({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          name: "Test User",
          passwordHash: "$2a$12$hashedpassword",
          credits: { create: { balance: 100, lifetime: 100 } },
        },
      });
    });

    it("should throw ConflictException if email already exists", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "existing-user",
        email: "test@example.com",
      });

      await expect(
        service.register("test@example.com", "password123")
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(true);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
        passwordHash: "$2a$12$hashedpassword",
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login("test@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user).toEqual({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it("should throw UnauthorizedException when user not found", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login("nonexistent@example.com", "password123")
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when password is invalid", async () => {
      const bcrypt = require("bcryptjs");
      bcrypt.compare.mockResolvedValue(false);

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "USER",
        passwordHash: "$2a$12$hashedpassword",
      });

      await expect(
        service.login("test@example.com", "wrongpassword")
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("validateOAuth", () => {
    it("should return tokens for existing OAuth account", async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValue({
        id: "account-1",
        provider: "google",
        providerAccountId: "goog-123",
        user: {
          id: "user-1",
          email: "test@example.com",
          role: "USER",
        },
      });

      const result = await service.validateOAuth("google", "goog-123", "test@example.com");

      expect(result).toHaveProperty("accessToken");
      expect(result.user.id).toBe("user-1");
    });

    it("should create new user and account when OAuth account does not exist", async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: "user-new",
        email: "new@example.com",
        role: "USER",
      });

      const result = await service.validateOAuth("google", "goog-456", "new@example.com", "New User");

      expect(result).toHaveProperty("accessToken");
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: "new@example.com",
          name: "New User",
          credits: { create: { balance: 100, lifetime: 100 } },
          accounts: {
            create: { provider: "google", providerAccountId: "goog-456" },
          },
        },
      });
    });

    it("should link OAuth account to existing user", async () => {
      (prisma.account.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-existing",
        email: "existing@example.com",
        role: "USER",
      });
      (prisma.account.create as jest.Mock).mockResolvedValue({});

      const result = await service.validateOAuth("google", "goog-789", "existing@example.com");

      expect(result).toHaveProperty("accessToken");
      expect(result.user.id).toBe("user-existing");
      expect(prisma.account.create).toHaveBeenCalledWith({
        data: {
          userId: "user-existing",
          provider: "google",
          providerAccountId: "goog-789",
        },
      });
    });
  });
});
