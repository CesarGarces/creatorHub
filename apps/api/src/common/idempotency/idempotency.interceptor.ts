import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { HTTP_CODE_METADATA } from "@nestjs/common/constants";
import { Observable, of, from, throwError } from "rxjs";
import { catchError, mergeMap } from "rxjs/operators";
import { createHash } from "crypto";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.provider";

/**
 * How long a stored response is replayable. 24h matches payment-industry
 * practice (Stripe) and comfortably covers client retry windows.
 */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const PROCESSING_PREFIX = "__processing__:";

/**
 * Idempotency-Key support (SEC-05), Stripe-style.
 *
 * - First request with a given key executes normally; its response is stored
 *   in Redis under the key.
 * - A replay with the same key AND the same payload fingerprint receives the
 *   stored response without re-executing the handler.
 * - A concurrent request with the same key while the first is still running
 *   receives 409 (the client must retry after the first completes).
 * - A replay with the same key but a DIFFERENT payload receives 422.
 * - Failed requests are never cached, so the same key can be safely retried.
 *
 * This is a UX/retry-safety layer. The ultimate integrity guarantee remains
 * the database unique constraints (they convert duplicates into 409 even if
 * this layer misses, e.g. Redis eviction).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const key = req.headers["idempotency-key"];

    // Header is optional: clients without it get the normal flow.
    if (key === undefined) return next.handle();

    if (typeof key !== "string" || key.length === 0 || key.length > 128) {
      throw new BadRequestException("Invalid Idempotency-Key header");
    }

    const fingerprint = this.fingerprint(req);
    const redisKey = `idempotency:${req.method}:${req.path}:${key}`;

    // Atomic acquire: only one request with this key may execute.
    const acquired = await this.redis.set(
      redisKey,
      `${PROCESSING_PREFIX}${fingerprint}`,
      "PX",
      IDEMPOTENCY_TTL_MS,
      "NX",
    );

    if (!acquired) {
      const existing = await this.redis.get(redisKey);

      if (existing === null) {
        // Key expired between the SET and the GET (extremely unlikely):
        // refuse rather than risk a duplicate side effect.
        throw new ConflictException(
          "Conflicting request with the same Idempotency-Key",
        );
      }

      if (existing.startsWith(PROCESSING_PREFIX)) {
        const inFlightFingerprint = existing.slice(PROCESSING_PREFIX.length);
        if (inFlightFingerprint !== fingerprint) {
          throw new UnprocessableEntityException(
            "Idempotency-Key was already used with a different request payload",
          );
        }
        throw new ConflictException(
          "A request with the same Idempotency-Key is still in progress",
        );
      }

      const stored = JSON.parse(existing) as {
        fingerprint: string;
        statusCode: number;
        body: unknown;
      };
      if (stored.fingerprint !== fingerprint) {
        throw new UnprocessableEntityException(
          "Idempotency-Key was already used with a different request payload",
        );
      }

      // Replay the original response without re-executing the handler.
      res.status(stored.statusCode);
      return of(stored.body);
    }

    const successStatusCode =
      this.reflector.get<number>(HTTP_CODE_METADATA, context.getHandler()) ??
      (req.method === "POST" ? 201 : 200);

    return next.handle().pipe(
      mergeMap((body) =>
        from(
          this.redis.set(
            redisKey,
            JSON.stringify({
              fingerprint,
              statusCode: successStatusCode,
              body,
            }),
            "PX",
            IDEMPOTENCY_TTL_MS,
          ),
        ).pipe(mergeMap(() => of(body))),
      ),
      catchError((err: unknown) =>
        // Never cache failures: delete the key so the client can retry.
        from(this.redis.del(redisKey)).pipe(
          mergeMap(() => throwError(() => err)),
        ),
      ),
    );
  }

  /**
   * Stable fingerprint of the request payload, so a key reused with a
   * different body is rejected instead of replaying an unrelated response.
   */
  private fingerprint(req: {
    method: string;
    path: string;
    body?: unknown;
  }): string {
    const body = req.body === undefined ? "" : JSON.stringify(req.body);
    return createHash("sha256")
      .update(`${req.method}:${req.path}:${body}`)
      .digest("hex");
  }
}
