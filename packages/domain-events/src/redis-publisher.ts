import Redis from "ioredis";
import { DomainEventPublisher } from "./domain-event-publisher";

export class RedisEventPublisher implements DomainEventPublisher {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
  }

  async publish<T>(channel: string, event: T): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(event));
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
