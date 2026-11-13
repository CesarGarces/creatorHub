import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Minimum token length. A 32-byte random value encoded as hex is 64 chars;
 * `openssl rand -hex 32` is the recommended way to generate it.
 */
const MIN_TOKEN_LENGTH = 32;

const TOKEN_ENV = "COMMUNITY_WORKER_HEALTH_TOKEN";

interface HeaderRequest {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Protects the health endpoint with a shared secret.
 *
 * Why a static token instead of HMAC:
 * external uptime/cron providers can send a fixed header, but cannot compute
 * an HMAC signature. The token is sent via header (never in the URL) so it
 * does not leak through access logs, browser history or Referer headers.
 *
 * Both header styles are accepted to make integration with third-party
 * monitors easy:
 *   Authorization: Bearer <token>
 *   X-Health-Check-Token: <token>
 */
@Injectable()
export class HealthTokenGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(HealthTokenGuard.name);
  private readonly expectedTokenHash: Buffer | null;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>(TOKEN_ENV)?.trim();

    if (token && token.length >= MIN_TOKEN_LENGTH) {
      // Hash both sides before comparing so timingSafeEqual always receives
      // buffers of the same length and token length is not leaked.
      this.expectedTokenHash = this.hash(token);
    } else {
      this.expectedTokenHash = null;
    }
  }

  onModuleInit(): void {
    const token = this.config.get<string>(TOKEN_ENV)?.trim();

    if (!token) {
      this.logger.warn(
        `${TOKEN_ENV} is not set. The /health endpoint is disabled (fail-closed).`,
      );
      return;
    }

    if (token.length < MIN_TOKEN_LENGTH) {
      this.logger.error(
        `${TOKEN_ENV} is shorter than ${MIN_TOKEN_LENGTH} characters. ` +
          "The /health endpoint is disabled until a stronger token is configured.",
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // Fail closed: if the secret is missing or too weak, never allow access.
    if (!this.expectedTokenHash) {
      throw new ServiceUnavailableException("Health check is not configured");
    }

    const request = context.switchToHttp().getRequest<HeaderRequest>();
    const providedToken = this.extractToken(request);

    if (!providedToken) {
      throw new UnauthorizedException("Invalid health token");
    }

    const providedTokenHash = this.hash(providedToken);

    if (!timingSafeEqual(providedTokenHash, this.expectedTokenHash)) {
      throw new UnauthorizedException("Invalid health token");
    }

    return true;
  }

  private extractToken(request: HeaderRequest): string | null {
    const authorization = request.headers.authorization;

    if (typeof authorization === "string") {
      const [scheme, token] = authorization.split(" ");

      if (scheme?.toLowerCase() === "bearer" && token) {
        return token;
      }
    }

    const customToken = request.headers["x-health-check-token"];

    if (typeof customToken === "string" && customToken) {
      return customToken;
    }

    return null;
  }

  private hash(value: string): Buffer {
    return createHash("sha256").update(value, "utf8").digest();
  }
}
