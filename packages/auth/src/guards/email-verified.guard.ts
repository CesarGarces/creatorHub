import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

export const SKIP_EMAIL_VERIFICATION_KEY = "skipEmailVerification";

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const skipVerification = this.reflector.getAllAndOverride<boolean>(
      SKIP_EMAIL_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipVerification) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true;

    if (user.role === "ADMIN") return true;

    if (!user.emailVerified) {
      throw new ForbiddenException(
        "Email not verified. Please check your inbox for the verification code.",
      );
    }

    return true;
  }
}
