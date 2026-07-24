import { Module } from "@nestjs/common";
import { redisProvider } from "../redis/redis.provider";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

/**
 * Provides Idempotency-Key support for sensitive POST endpoints.
 * Import this module and apply @UseInterceptors(IdempotencyInterceptor)
 * on endpoints that must be safe to retry (registration, payments, ...).
 */
@Module({
  providers: [redisProvider, IdempotencyInterceptor],
  // REDIS_CLIENT must also be exported: controllers applying the interceptor
  // are instantiated in their own module's injector context.
  exports: [redisProvider, IdempotencyInterceptor],
})
export class IdempotencyModule {}
