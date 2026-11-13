import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from "@nestjs/common/constants";
import { JwtAuthGuard } from "@creator-hub/auth";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { AuthController } from "../auth.controller";
import { IdempotencyInterceptor } from "../../../common/idempotency/idempotency.interceptor";

const IS_PUBLIC_KEY = "isPublic";
const proto = AuthController.prototype;

function methodMeta(key: string, method: keyof AuthController) {
  return Reflect.getMetadata(key, proto[method]);
}

describe("AuthController", () => {
  const authService = {
    register: vi.fn(),
    login: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    getVerificationStatus: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    validateResetToken: vi.fn(),
    changePassword: vi.fn(),
    getMe: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
  };
  const emailService = {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  };
  const controller = new AuthController(
    authService as never,
    emailService as never,
  );
  const originalFrontendUrl = process.env.FRONTEND_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMock();
  });

  afterEach(() => {
    process.env.FRONTEND_URL = originalFrontendUrl;
  });

  describe("register", () => {
    it("emails the verification code but never returns it in the response", async () => {
      authService.register.mockResolvedValue({
        accessToken: "at",
        refreshToken: "rt",
        emailVerified: false,
        requiresVerification: true,
        verificationCode: "123456",
        userName: "Ana",
      });

      const response = await controller.register({
        email: "ana@x.com",
        password: "password123",
        name: "Ana",
      });

      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        "ana@x.com",
        { code: "123456", userName: "Ana" },
      );
      expect(response).toEqual({
        accessToken: "at",
        refreshToken: "rt",
        emailVerified: false,
        requiresVerification: true,
      });
      expect(JSON.stringify(response)).not.toContain("123456");
    });

    it("does not send an email when no verification code was generated", async () => {
      authService.register.mockResolvedValue({ accessToken: "at" });

      await controller.register({ email: "a@x.com", password: "password123" });

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe("resendVerification", () => {
    it("sends the stored code when one exists", async () => {
      authService.resendVerification.mockResolvedValue({ message: "sent" });
      prismaMock.user.findUnique.mockResolvedValue({
        verificationCode: "654321",
        name: null,
      });

      const result = await controller.resendVerification({ email: "a@x.com" });

      expect(result).toEqual({ message: "sent" });
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        "a@x.com",
        { code: "654321", userName: undefined },
      );
      expect(JSON.stringify(result)).not.toContain("654321");
    });

    it("sends nothing for an unknown or already-verified email", async () => {
      authService.resendVerification.mockResolvedValue({ message: "ok" });
      prismaMock.user.findUnique.mockResolvedValue(null);

      await controller.resendVerification({ email: "ghost@x.com" });

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe("forgotPassword", () => {
    it("emails a reset link built from FRONTEND_URL and never returns the token", async () => {
      process.env.FRONTEND_URL = "https://app.example.com";
      authService.forgotPassword.mockResolvedValue({
        message: "If an account exists, a reset link was sent.",
        token: "reset-token-abc",
      });
      prismaMock.user.findUnique.mockResolvedValue({ name: "Ana" });

      const response = await controller.forgotPassword({ email: "ana@x.com" });

      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        "ana@x.com",
        {
          resetUrl:
            "https://app.example.com/auth/reset-password?token=reset-token-abc",
          userName: "Ana",
        },
      );
      expect(response).toEqual({
        message: "If an account exists, a reset link was sent.",
      });
      expect(JSON.stringify(response)).not.toContain("reset-token-abc");
    });

    it("returns the same message for unknown emails without sending anything", async () => {
      authService.forgotPassword.mockResolvedValue({
        message: "If an account exists, a reset link was sent.",
      });

      const response = await controller.forgotPassword({
        email: "ghost@x.com",
      });

      expect(response).toEqual({
        message: "If an account exists, a reset link was sent.",
      });
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("delegation", () => {
    it("passes the authenticated user id to account operations", async () => {
      await controller.changePassword("u1", {
        currentPassword: "old-pass",
        newPassword: "new-password",
      });
      await controller.getMe("u1");
      await controller.updateProfile("u1", { name: "New" });
      await controller.deleteAccount("u1");

      expect(authService.changePassword).toHaveBeenCalledWith(
        "u1",
        "old-pass",
        "new-password",
      );
      expect(authService.getMe).toHaveBeenCalledWith("u1");
      expect(authService.updateProfile).toHaveBeenCalledWith("u1", "New");
      expect(authService.deleteAccount).toHaveBeenCalledWith("u1");
    });

    it("forwards login, verification and reset calls", async () => {
      await controller.login({ email: "a@x.com", password: "pw" });
      await controller.verifyEmail({ email: "a@x.com", code: "111111" });
      await controller.resetPassword({ token: "t", newPassword: "password1" });
      await controller.validateResetToken("t");
      await controller.getVerificationStatus("a@x.com");

      expect(authService.login).toHaveBeenCalledWith("a@x.com", "pw");
      expect(authService.verifyEmail).toHaveBeenCalledWith("a@x.com", "111111");
      expect(authService.resetPassword).toHaveBeenCalledWith("t", "password1");
      expect(authService.validateResetToken).toHaveBeenCalledWith("t");
      expect(authService.getVerificationStatus).toHaveBeenCalledWith("a@x.com");
    });
  });

  describe("route security metadata", () => {
    it.each([
      "register",
      "login",
      "verifyEmail",
      "resendVerification",
      "forgotPassword",
      "resetPassword",
    ] as const)("%s is public", (method) => {
      expect(methodMeta(IS_PUBLIC_KEY, method)).toBe(true);
    });

    it.each([
      "changePassword",
      "getMe",
      "updateProfile",
      "deleteAccount",
    ] as const)("%s requires a JWT and is not public", (method) => {
      expect(methodMeta(GUARDS_METADATA, method)).toEqual([JwtAuthGuard]);
      expect(methodMeta(IS_PUBLIC_KEY, method)).toBeUndefined();
    });

    it.each([
      ["register", 5, 3_600_000],
      ["login", 10, 60_000],
      ["verifyEmail", 10, 300_000],
      ["resendVerification", 3, 300_000],
      ["forgotPassword", 3, 300_000],
      ["resetPassword", 5, 300_000],
    ] as const)(
      "%s is rate limited to %i requests per %i ms",
      (method, limit, ttl) => {
        expect(methodMeta("THROTTLER:LIMITdefault", method)).toBe(limit);
        expect(methodMeta("THROTTLER:TTLdefault", method)).toBe(ttl);
      },
    );

    it("register supports Idempotency-Key retries", () => {
      expect(methodMeta(INTERCEPTORS_METADATA, "register")).toEqual([
        IdempotencyInterceptor,
      ]);
    });
  });
});
