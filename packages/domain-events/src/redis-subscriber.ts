import Redis from "ioredis";
import { DomainEventSubscriber, EventHandler } from "./domain-event-subscriber";

export class RedisEventSubscriber implements DomainEventSubscriber {
  private redis: Redis;
  private handlers = new Map<string, EventHandler>();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on("message", (channel, message) => {
      const handler = this.handlers.get(channel);
      if (handler) {
        try {
          handler(JSON.parse(message));
        } catch {
          // malformed message — ignore
        }
      }
    });
  }

  async subscribe<T>(channel: string, handler: EventHandler<T>): Promise<void> {
    this.handlers.set(channel, handler as EventHandler);
    await this.redis.subscribe(channel);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.handlers.delete(channel);
    await this.redis.unsubscribe(channel);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
