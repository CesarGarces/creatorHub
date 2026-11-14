import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@creator-hub/database", () => ({
  prisma: { user: { findUnique, update } },
}));
vi.mock("bcryptjs", () => ({ compare: vi.fn(async () => true) }));

import { AdminAuthController } from "../admin-auth.controller";

const jwt = { sign: vi.fn(() => "signed-token") };
const controller = new AdminAuthController(jwt as never);

const admin = {
  id: "admin-1",
  email: "admin@example.com",
  role: "ADMIN",
  passwordHash: "hash",
};

describe("AdminAuthController.adminLogin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
  });

  it("returns the admin's saved interface language", async () => {
    findUnique.mockResolvedValue({ ...admin, preferredLanguage: "pt" });

    const res = await controller.adminLogin({
      email: admin.email,
      password: "secret",
    });

    expect(res.data.accessToken).toBe("signed-token");
    expect(res.data.user).toEqual({
      id: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
      preferredLanguage: "pt",
    });
  });

  it("returns null when no language was chosen yet", async () => {
    findUnique.mockResolvedValue({ ...admin, preferredLanguage: null });

    const res = await controller.adminLogin({
      email: admin.email,
      password: "secret",
    });

    expect(res.data.user.preferredLanguage).toBeNull();
  });

  it("still rejects non-admin accounts", async () => {
    findUnique.mockResolvedValue({ ...admin, role: "USER" });

    await expect(
      controller.adminLogin({ email: admin.email, password: "secret" }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
