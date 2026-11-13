import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

jest.mock("@creator-hub/database", () => ({
  ...jest.requireActual("@creator-hub/database"),
  prisma: require("./helpers/prisma-mock").prismaMock,
}));

import { prismaMock, resetPrismaMock } from "./helpers/prisma-mock";
import { AuthService } from "../auth.service";

const SECRET = "test-jwt-secret";

describe("AuthService account flows", () => {
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { expiresIn: "7d" },
  });
  const storage = {
    getDefaultBucket: jest.fn(() => "assets"),
    delete: jest.fn(),
  };
  let service: AuthService;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash("current-password", 4);
  });

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
    storage.delete.mockResolvedValue(undefined);
    service = new AuthService(jwt, storage as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("tokens", () => {
    it("issues a 7-day access token and a 30-day refresh token for the user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "ana@x.com",
        role: "USER",
        name: "Ana",
        passwordHash,
        emailVerified: new Date(),
      });

      const result = await service.login("ana@x.com", "current-password");

      const access = jwt.verify(result.accessToken);
      const refresh = jwt.verify(result.refreshToken);
      expect(access).toMatchObject({
        sub: "u1",
        email: "ana@x.com",
        role: "USER",
      });
      expect(access.exp - access.iat).toBe(7 * 24 * 3600);
      expect(refresh.exp - refresh.iat).toBe(30 * 24 * 3600);
      expect(result).toMatchObject({
        emailVerified: true,
        requiresVerification: false,
        user: { id: "u1", email: "ana@x.com", role: "USER", name: "Ana" },
      });
      expect(JSON.stringify(result)).not.toContain(passwordHash);
    });

    it("rejects OAuth-only accounts (no password) with a generic message", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        passwordHash: null,
      });

      await expect(service.login("ana@x.com", "anything")).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );
    });
  });

  describe("changePassword", () => {
    it("verifies the current password and stores a new bcrypt hash", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash });

      await expect(
        service.changePassword("u1", "current-password", "brand-new-password"),
      ).resolves.toEqual({ message: "Password updated successfully" });

      const { data } = prismaMock.user.update.mock.calls[0][0];
      expect(
        await bcrypt.compare("brand-new-password", data.passwordHash),
      ).toBe(true);
    });

    it("rejects a wrong current password", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1", passwordHash });

      await expect(
        service.changePassword("u1", "wrong", "brand-new-password"),
      ).rejects.toThrow(UnauthorizedException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("rejects short new passwords and accounts without a password", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "u1",
        passwordHash,
      });
      await expect(
        service.changePassword("u1", "current-password", "short"),
      ).rejects.toThrow("New password must be at least 8 characters");

      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "u1",
        passwordHash: null,
      });
      await expect(
        service.changePassword("u1", "x", "long-enough"),
      ).rejects.toThrow("No password set for this account");
    });
  });

  describe("profile", () => {
    it("returns the current user without secrets", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@x.com",
      });

      await service.getMe("u1");

      const { select } = prismaMock.user.findUnique.mock.calls[0][0];
      expect(select.passwordHash).toBeUndefined();
      expect(select.verificationCode).toBeUndefined();
      expect(select.passwordResetToken).toBeUndefined();
    });

    it("rejects unknown users", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe("gone")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("updates the display name", async () => {
      await service.updateProfile("u1", "New Name");
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { name: "New Name" },
      });
    });
  });

  describe("deleteAccount", () => {
    it("deletes the user's stored files before deleting the user", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        avatarUrl: "assets/avatars/u1.png",
      });
      prismaMock.generatedImage.findMany.mockResolvedValue([
        { url: "https://r2.example.com/assets/u1/a.png" },
        { url: "assets/u1/b.png" },
        { url: "https://cdn.other.com/x.png" }, // single path segment → not ours
      ]);

      await expect(service.deleteAccount("u1")).resolves.toEqual({
        message: "Account deleted successfully",
      });

      expect(storage.delete.mock.calls).toEqual([
        ["u1/a.png", "assets"],
        ["u1/b.png", "assets"],
        ["avatars/u1.png", "assets"],
      ]);
      expect(prismaMock.user.delete).toHaveBeenCalledWith({
        where: { id: "u1" },
      });
    });

    it("still deletes the account when a file cannot be removed", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => {});
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        avatarUrl: "https://avatars.example/x.png",
      });
      prismaMock.generatedImage.findMany.mockResolvedValue([
        { url: "assets/u1/a.png" },
      ]);
      storage.delete.mockRejectedValue(new Error("storage down"));

      await service.deleteAccount("u1");

      expect(prismaMock.user.delete).toHaveBeenCalled();
      expect(storage.delete).toHaveBeenCalledTimes(1); // external avatar URL untouched
    });

    it("rejects unknown users", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.deleteAccount("gone")).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.user.delete).not.toHaveBeenCalled();
    });
  });

  describe("email verification", () => {
    const future = () => new Date(Date.now() + 60_000);

    it("verifies a correct, unexpired code and clears it", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@x.com",
        role: "USER",
        emailVerified: null,
        verificationCode: "123456",
        verificationExpires: future(),
      });
      prismaMock.user.update.mockImplementation(
        async ({ data }: { data: object }) => ({
          id: "u1",
          email: "a@x.com",
          role: "USER",
          ...data,
        }),
      );

      const result = await service.verifyEmail("a@x.com", "123456");

      expect(result.message).toBe("Email verified successfully");
      expect(prismaMock.user.update.mock.calls[0][0].data).toEqual({
        emailVerified: expect.any(Date),
        verificationCode: null,
        verificationExpires: null,
      });
      expect(result.user).not.toHaveProperty("verificationCode");
    });

    it.each([
      [
        { verificationCode: "123456", verificationExpires: new Date(0) },
        "999999",
        /expired/,
      ],
      [
        {
          verificationCode: "123456",
          verificationExpires: new Date(Date.now() + 60_000),
        },
        "000000",
        /Invalid verification code/,
      ],
      [
        { verificationCode: null, verificationExpires: null },
        "123456",
        /No verification code pending/,
      ],
    ])("rejects %o with code %s", async (state, code, message) => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        emailVerified: null,
        ...state,
      });

      await expect(service.verifyEmail("a@x.com", code)).rejects.toThrow(
        message,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("is idempotent for already verified users", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "a@x.com",
        role: "USER",
        emailVerified: new Date(),
      });

      expect((await service.verifyEmail("a@x.com", "whatever")).message).toBe(
        "Email already verified",
      );
    });

    it("issues a fresh 6-digit code valid for 10 minutes, with a 60s resend cooldown", async () => {
      jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
      prismaMock.user.findUnique.mockResolvedValue({
        id: "u1",
        emailVerified: null,
      });

      await expect(service.resendVerification("a@x.com")).resolves.toEqual({
        message: "Verification code sent",
        cooldownSeconds: 60,
      });
      const { data } = prismaMock.user.update.mock.calls[0][0];
      expect(data.verificationCode).toMatch(/^\d{6}$/);
      expect(data.verificationExpires.toISOString()).toBe(
        "2026-01-01T00:10:00.000Z",
      );

      jest.advanceTimersByTime(20_000);
      await expect(service.resendVerification("a@x.com")).rejects.toThrow(
        "Please wait 40 seconds before requesting a new code",
      );

      jest.advanceTimersByTime(40_000);
      await expect(
        service.resendVerification("a@x.com"),
      ).resolves.toBeDefined();
    });

    it("does not resend for verified or unknown users", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: "u1",
        emailVerified: new Date(),
      });
      await expect(service.resendVerification("a@x.com")).rejects.toThrow(
        "already verified",
      );

      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.resendVerification("ghost@x.com")).rejects.toThrow(
        "User not found",
      );
    });

    it("reports verification status", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        emailVerified: null,
        verificationCode: "1",
      });
      expect(await service.getVerificationStatus("a@x.com")).toEqual({
        verified: false,
        pending: true,
      });
    });
  });

  describe("password reset", () => {
    it("creates a random 64-hex-char token valid for 10 minutes", async () => {
      jest.useFakeTimers({ now: new Date("2026-01-01T00:00:00Z") });
      prismaMock.user.findUnique.mockResolvedValue({ id: "u1" });

      const first = await service.forgotPassword("a@x.com");
      const second = await service.forgotPassword("a@x.com");

      expect(first.token).toMatch(/^[0-9a-f]{64}$/);
      expect(second.token).not.toBe(first.token);
      expect(
        prismaMock.user.update.mock.calls[0][0].data.passwordResetExpires.toISOString(),
      ).toBe("2026-01-01T00:10:00.000Z");
    });

    it("returns the same message for unknown emails (no account enumeration)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword("ghost@x.com");

      expect(result).toEqual({
        message: "If an account exists, a reset link was sent.",
      });
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("resets the password with a valid token and invalidates it", async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: "u1" });

      await service.resetPassword("tok", "new-password-123");

      const where = prismaMock.user.findFirst.mock.calls[0][0].where;
      expect(where.passwordResetToken).toBe("tok");
      expect(where.passwordResetExpires.gt).toBeInstanceOf(Date);
      const { data } = prismaMock.user.update.mock.calls[0][0];
      expect(data.passwordResetToken).toBeNull();
      expect(data.passwordResetExpires).toBeNull();
      expect(await bcrypt.compare("new-password-123", data.passwordHash)).toBe(
        true,
      );
    });

    it("rejects invalid/expired tokens and short passwords", async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword("bad", "new-password-123"),
      ).rejects.toThrow("Invalid or expired reset token");

      prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u1" });
      await expect(service.resetPassword("tok", "short")).rejects.toThrow(
        "Password must be at least 8 characters",
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("validates tokens without revealing anything else", async () => {
      prismaMock.user.findFirst
        .mockResolvedValueOnce({ id: "u1" })
        .mockResolvedValueOnce(null);

      expect(await service.validateResetToken("good")).toEqual({ valid: true });
      expect(await service.validateResetToken("bad")).toEqual({ valid: false });
    });
  });
});
