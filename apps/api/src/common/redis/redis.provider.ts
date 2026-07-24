import { Provider } from "@nestjs/common";
import Redis from "ioredis";

export const REDIS_CLIENT = "REDIS_CLIENT";

/**
 * Shared ioredis client for API infrastructure concerns (idempotency keys,
 * distributed locks, etc.). Redis is already a hard dependency of this app
 * (BullMQ queues, domain events), so this adds no new point of failure.
 */
export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () =>
    process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL)
      : new Redis({
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
        }),
};
