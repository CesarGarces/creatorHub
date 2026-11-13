import {
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  UnauthorizedException,
} from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";

jest.mock("@creator-hub/database", () => ({
  ...jest.requireActual("@creator-hub/database"),
  prisma: require("./helpers/prisma-mock").prismaMock,
}));

import { prismaMock, resetPrismaMock } from "./helpers/prisma-mock";
import { Public } from "../decorators/public.decorator";
import { Roles } from "../decorators/roles.decorator";
import { MinPlan } from "../decorators/min-plan.decorator";
import { CurrentUser } from "../decorators/current-user.decorator";
import { SkipEmailVerification } from "../decorators/skip-email-verification.decorator";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { EmailVerifiedGuard } from "../guards/email-verified.guard";
import { PlanGuard, AuthenticatedPlanGuard } from "../guards/plan.guard";
import { JwtStrategy } from "../strategies/jwt.strategy";

@Controller()
class TestController {
  @Public()
  @Get("public")
  publicRoute() {}

  @Get("private")
  privateRoute() {}

  @Roles("ADMIN")
  @Get("admin")
  adminRoute() {}

  @MinPlan("PRO")
  @Get("pro")
  proRoute() {}

  @MinPlan("STARTER")
  @Get("starter")
  starterRoute() {}

  @SkipEmailVerification()
  @Get("unverified-ok")
  unverifiedRoute() {}
}

function context(
  handler: keyof TestController,
  user?: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

const reflector = new Reflector();

beforeEach(() => resetPrismaMock());

describe("JwtAuthGuard", () => {
  const guard = new JwtAuthGuard(reflector);
  const passportCanActivate = jest
    .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), "canActivate")
    .mockReturnValue(true);

  beforeEach(() => passportCanActivate.mockClear());

  it("lets @Public() routes through without checking a token", () => {
    expect(guard.canActivate(context("publicRoute"))).toBe(true);
    expect(passportCanActivate).not.toHaveBeenCalled();
  });

  it("requires a valid JWT everywhere else", () => {
    guard.canActivate(context("privateRoute"));
    expect(passportCanActivate).toHaveBeenCalled();
  });
});

describe("RolesGuard", () => {
  const guard = new RolesGuard(reflector);

  it("allows routes without role requirements", () => {
    expect(guard.canActivate(context("privateRoute", { role: "USER" }))).toBe(
      true,
    );
  });

  it("only allows the required role", () => {
    expect(guard.canActivate(context("adminRoute", { role: "ADMIN" }))).toBe(
      true,
    );
    expect(guard.canActivate(context("adminRoute", { role: "USER" }))).toBe(
      false,
    );
  });
});

describe("EmailVerifiedGuard", () => {
  const guard = new EmailVerifiedGuard(reflector);

  it("blocks unverified users", () => {
    expect(() =>
      guard.canActivate(
        context("privateRoute", { role: "USER", emailVerified: null }),
      ),
    ).toThrow(ForbiddenException);
  });

  it.each([
    [
      "verified users",
      "privateRoute",
      { role: "USER", emailVerified: new Date() },
    ],
    ["admins", "privateRoute", { role: "ADMIN", emailVerified: null }],
    ["public routes", "publicRoute", { role: "USER", emailVerified: null }],
    [
      "@SkipEmailVerification routes",
      "unverifiedRoute",
      { role: "USER", emailVerified: null },
    ],
    [
      "unauthenticated requests (left to JwtAuthGuard)",
      "privateRoute",
      undefined,
    ],
  ] as const)("allows %s", (_label, handler, user) => {
    expect(guard.canActivate(context(handler, user as never))).toBe(true);
  });
});

describe("PlanGuard (global)", () => {
  const guard = new PlanGuard(reflector);

  it("ignores routes without a plan requirement and anonymous requests", async () => {
    await expect(
      guard.canActivate(context("privateRoute", { id: "u1" })),
    ).resolves.toBe(true);
    await expect(guard.canActivate(context("proRoute"))).resolves.toBe(true);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["PRO", "USER", true],
    ["PREMIUM", "USER", false],
    ["FREE", "USER", false],
    ["FREE", "ADMIN", true],
  ])(
    "plan %s / role %s → PRO route allowed: %s",
    async (plan, role, allowed) => {
      prismaMock.user.findUnique.mockResolvedValue({ plan, role });

      const result = guard.canActivate(context("proRoute", { id: "u1" }));

      if (allowed) await expect(result).resolves.toBe(true);
      else await expect(result).rejects.toThrow(/requires PRO plan or higher/);
    },
  );

  it("orders plans FREE < STARTER < PAY_AS_YOU_GO < PREMIUM < PRO", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      plan: "PAY_AS_YOU_GO",
      role: "USER",
    });
    await expect(
      guard.canActivate(context("starterRoute", { id: "u1" })),
    ).resolves.toBe(true);

    prismaMock.user.findUnique.mockResolvedValue({
      plan: "FREE",
      role: "USER",
    });
    await expect(
      guard.canActivate(context("starterRoute", { id: "u1" })),
    ).rejects.toThrow(ForbiddenException);
  });

  it("rejects deleted users", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(context("proRoute", { id: "gone" })),
    ).rejects.toThrow("User not found");
  });
});

describe("AuthenticatedPlanGuard (per-route)", () => {
  const guard = new AuthenticatedPlanGuard(reflector);

  it("requires authentication on plan-restricted routes", async () => {
    await expect(guard.canActivate(context("proRoute"))).rejects.toThrow(
      "User not authenticated",
    );
  });

  it("enforces the plan level", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      plan: "STARTER",
      role: "USER",
    });
    await expect(
      guard.canActivate(context("proRoute", { id: "u1" })),
    ).rejects.toThrow(ForbiddenException);

    prismaMock.user.findUnique.mockResolvedValue({ plan: "PRO", role: "USER" });
    await expect(
      guard.canActivate(context("proRoute", { id: "u1" })),
    ).resolves.toBe(true);
  });

  it("allows routes without a plan requirement", async () => {
    await expect(guard.canActivate(context("privateRoute"))).resolves.toBe(
      true,
    );
  });
});

describe("JwtStrategy", () => {
  const strategy = new JwtStrategy(new ConfigService({ JWT_SECRET: "s3cret" }));

  it("loads the active user for the token subject", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@x.com",
      role: "USER",
      isActive: true,
      emailVerified: null,
    });

    await expect(
      strategy.validate({ sub: "u1", email: "a@x.com", role: "USER" }),
    ).resolves.toMatchObject({
      id: "u1",
    });
    expect(
      prismaMock.user.findUnique.mock.calls[0][0].select.passwordHash,
    ).toBeUndefined();
  });

  it.each([
    ["deleted", null],
    ["deactivated", { id: "u1", isActive: false }],
  ])("rejects tokens of %s users", async (_label, user) => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    await expect(
      strategy.validate({ sub: "u1", email: "a", role: "USER" }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

describe("CurrentUser decorator", () => {
  function factoryOf(decorator: ParameterDecorator) {
    class Host {
      handler(_value: unknown) {}
    }
    decorator(Host.prototype, "handler", 0);
    const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, Host, "handler");
    return args[Object.keys(args)[0]!].factory as (
      data: unknown,
      ctx: ExecutionContext,
    ) => unknown;
  }

  const user = { id: "u1", email: "a@x.com" };
  const ctx = context("privateRoute", user);

  it("returns the whole user or a single field", () => {
    expect(factoryOf(CurrentUser())(undefined, ctx)).toBe(user);
    expect(factoryOf(CurrentUser("id"))("id", ctx)).toBe("u1");
  });

  it("returns undefined for anonymous requests", () => {
    expect(
      factoryOf(CurrentUser("id"))("id", context("publicRoute")),
    ).toBeUndefined();
  });
});
