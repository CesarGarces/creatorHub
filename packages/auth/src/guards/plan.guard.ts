import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { prisma } from "@creator-hub/database";
import { MIN_PLAN_KEY } from "../decorators/min-plan.decorator";

const PLAN_HIERARCHY = {
  FREE: 0,
  STARTER: 1,
  PAY_AS_YOU_GO: 2,
  PREMIUM: 3,
  PRO: 4,
  ADMIN: 5,
};

/**
 * Global guard that checks plan requirements.
 * When used as APP_GUARD, it runs before JwtAuthGuard.
 * If user is not authenticated yet, it skips the check
 * and lets JwtAuthGuard handle authentication.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(
      MIN_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return true;
    }

    return this.checkPlan(userId, requiredPlan);
  }

  protected async checkPlan(
    userId: string,
    requiredPlan: string,
  ): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, role: true },
    });

    if (!user) {
      throw new ForbiddenException("User not found");
    }

    const userPlanLevel =
      user.role === "ADMIN"
        ? PLAN_HIERARCHY.ADMIN
        : PLAN_HIERARCHY[user.plan as keyof typeof PLAN_HIERARCHY] || 0;

    const requiredPlanLevel =
      PLAN_HIERARCHY[requiredPlan as keyof typeof PLAN_HIERARCHY] || 0;

    if (userPlanLevel < requiredPlanLevel) {
      throw new ForbiddenException(
        `This feature requires ${requiredPlan} plan or higher. Please upgrade your plan to access this feature.`,
      );
    }

    return true;
  }
}

/**
 * Controller-level guard that enforces BOTH authentication AND plan check.
 * Use this in @UseGuards() alongside @MinPlan() on endpoints.
 */
@Injectable()
export class AuthenticatedPlanGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<string>(
      MIN_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new ForbiddenException("User not authenticated");
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, role: true },
    });

    if (!user) {
      throw new ForbiddenException("User not found");
    }

    const userPlanLevel =
      user.role === "ADMIN"
        ? PLAN_HIERARCHY.ADMIN
        : PLAN_HIERARCHY[user.plan as keyof typeof PLAN_HIERARCHY] || 0;

    const requiredPlanLevel =
      PLAN_HIERARCHY[requiredPlan as keyof typeof PLAN_HIERARCHY] || 0;

    if (userPlanLevel < requiredPlanLevel) {
      throw new ForbiddenException(
        `This feature requires ${requiredPlan} plan or higher. Please upgrade your plan to access this feature.`,
      );
    }

    return true;
  }
}
