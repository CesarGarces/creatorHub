import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";

vi.mock("@creator-hub/database", async (importOriginal) => {
  const { prismaMock } = await import("../../../__tests__/helpers/prisma-mock");
  return { ...(await importOriginal<object>()), prisma: prismaMock };
});

import {
  prismaMock,
  resetPrismaMock,
} from "../../../__tests__/helpers/prisma-mock";
import { AdminGuard } from "../admin.guard";
import { AdminAuthController } from "../admin-auth.controller";

function httpContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe("AdminGuard", () => {
  const guard = new AdminGuard();

  it("rejects unauthenticated requests", () => {
    expect(() => guard.canActivate(httpContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it("rejects authenticated non-admin users", () => {
    expect(() =>
      guard.canActivate(httpContext({ id: "u1", role: "USER" })),
    ).toThrow("Admin access required");
  });

  it("allows users with the ADMIN role", () => {
    expect(guard.canActivate(httpContext({ id: "a1", role: "ADMIN" }))).toBe(
      true,
    );
  });
});

describe("AdminAuthController.adminLogin", () => {
  const jwtService = { sign: vi.fn(() => "signed.jwt.token") };
  const controller = new AdminAuthController(jwtService as never);
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash("Correct-Horse-1", 4);
  });

  beforeEach(() => {
    resetPrismaMock();
    jwtService.sign.mockClear();
  });

  it("rejects an unknown email with a generic message", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      controller.adminLogin({ email: "nobody@x.com", password: "whatever" }),
    ).rejects.toThrow(
      new UnauthorizedException("Verify your email and password"),
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it("rejects a non-admin even when the password is correct", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "user@x.com",
      role: "USER",
      passwordHash,
    });

    await expect(
      controller.adminLogin({
        email: "user@x.com",
        password: "Correct-Horse-1",
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it("rejects OAuth-only admins that have no password hash", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "a1",
      email: "admin@x.com",
      role: "ADMIN",
      passwordHash: null,
    });

    await expect(
      controller.adminLogin({ email: "admin@x.com", password: "anything" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a wrong password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "a1",
      email: "admin@x.com",
      role: "ADMIN",
      passwordHash,
    });

    await expect(
      controller.adminLogin({
        email: "admin@x.com",
        password: "wrong-password",
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("issues a token and records the login for a valid admin", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "a1",
      email: "admin@x.com",
      role: "ADMIN",
      passwordHash,
    });
    prismaMock.user.update.mockResolvedValue({});

    const result = await controller.adminLogin({
      email: "admin@x.com",
      password: "Correct-Horse-1",
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: "a1",
      email: "admin@x.com",
      role: "ADMIN",
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { lastLoginAt: expect.any(Date) },
    });
    expect(result).toEqual({
      data: {
        accessToken: "signed.jwt.token",
        user: { id: "a1", email: "admin@x.com", role: "ADMIN" },
      },
    });
    expect(JSON.stringify(result)).not.toContain(passwordHash);
  });
});
