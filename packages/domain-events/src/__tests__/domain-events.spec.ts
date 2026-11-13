import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** In-memory stand-in for an ioredis connection. */
const redis = vi.hoisted(() => {
  const instances: Array<{
    url: string;
    options: {
      maxRetriesPerRequest: number;
      retryStrategy: (n: number) => number;
    };
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    emit: (event: string, ...args: unknown[]) => boolean;
  }> = [];
  return { instances };
});

vi.mock("ioredis", async () => {
  const { EventEmitter: Emitter } = await import("events");
  class FakeRedis extends Emitter {
    publish = vi.fn(async () => 1);
    subscribe = vi.fn(async () => 1);
    unsubscribe = vi.fn(async () => 1);
    quit = vi.fn(async () => "OK");
    constructor(
      public url: string,
      public options: never,
    ) {
      super();
      redis.instances.push(this as never);
    }
  }
  return { default: FakeRedis };
});

import { RedisEventPublisher } from "../redis-publisher";
import { RedisEventSubscriber } from "../redis-subscriber";
import { DomainEventsModule } from "../domain-events.module";
import { DOMAIN_EVENT_PUBLISHER, DOMAIN_EVENT_SUBSCRIBER } from "../tokens";

beforeEach(() => {
  redis.instances.length = 0;
});

describe("RedisEventPublisher", () => {
  it("connects with bounded retries and exponential-ish backoff capped at 2s", () => {
    new RedisEventPublisher("redis://cache:6379");
    const [conn] = redis.instances;

    expect(conn!.url).toBe("redis://cache:6379");
    expect(conn!.options.maxRetriesPerRequest).toBe(3);
    expect(conn!.options.retryStrategy(1)).toBe(50);
    expect(conn!.options.retryStrategy(10)).toBe(500);
    expect(conn!.options.retryStrategy(1000)).toBe(2000);
  });

  it("publishes events as JSON", async () => {
    const publisher = new RedisEventPublisher("redis://x");

    await publisher.publish("payment:success", { userId: "u1", amount: 100 });

    expect(redis.instances[0]!.publish).toHaveBeenCalledWith(
      "payment:success",
      '{"userId":"u1","amount":100}',
    );
  });

  it("closes the connection on disconnect", async () => {
    const publisher = new RedisEventPublisher("redis://x");
    await publisher.disconnect();
    expect(redis.instances[0]!.quit).toHaveBeenCalled();
  });
});

describe("RedisEventSubscriber", () => {
  it("delivers parsed events to the handler for that channel only", async () => {
    const subscriber = new RedisEventSubscriber("redis://x");
    const onPayment = vi.fn();
    const onVideo = vi.fn();

    await subscriber.subscribe("payment:success", onPayment);
    await subscriber.subscribe("video:completed", onVideo);
    redis.instances[0]!.emit("message", "payment:success", '{"userId":"u1"}');

    expect(redis.instances[0]!.subscribe).toHaveBeenCalledWith(
      "payment:success",
    );
    expect(onPayment).toHaveBeenCalledWith({ userId: "u1" });
    expect(onVideo).not.toHaveBeenCalled();
  });

  it("ignores messages for channels without a handler", () => {
    new RedisEventSubscriber("redis://x");
    expect(() =>
      redis.instances[0]!.emit("message", "unknown", "{}"),
    ).not.toThrow();
  });

  it("ignores malformed JSON instead of crashing", async () => {
    const subscriber = new RedisEventSubscriber("redis://x");
    const handler = vi.fn();
    await subscriber.subscribe("payment:success", handler);

    expect(() =>
      redis.instances[0]!.emit("message", "payment:success", "{not json"),
    ).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("swallows synchronous handler errors", async () => {
    const subscriber = new RedisEventSubscriber("redis://x");
    await subscriber.subscribe("payment:success", () => {
      throw new Error("handler bug");
    });

    expect(() =>
      redis.instances[0]!.emit("message", "payment:success", "{}"),
    ).not.toThrow();
  });

  it("stops delivering after unsubscribe", async () => {
    const subscriber = new RedisEventSubscriber("redis://x");
    const handler = vi.fn();
    await subscriber.subscribe("payment:success", handler);
    await subscriber.unsubscribe("payment:success");

    redis.instances[0]!.emit("message", "payment:success", "{}");

    expect(redis.instances[0]!.unsubscribe).toHaveBeenCalledWith(
      "payment:success",
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("replaces the handler when a channel is subscribed twice", async () => {
    const subscriber = new RedisEventSubscriber("redis://x");
    const first = vi.fn();
    const second = vi.fn();
    await subscriber.subscribe("c", first);
    await subscriber.subscribe("c", second);

    redis.instances[0]!.emit("message", "c", "{}");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});

describe("DomainEventsModule", () => {
  const originalUrl = process.env.REDIS_URL;
  afterEach(() => {
    process.env.REDIS_URL = originalUrl;
  });

  type FactoryProvider = { provide: symbol; useFactory: () => unknown };
  const providers = (): FactoryProvider[] =>
    Reflect.getMetadata("providers", DomainEventsModule) as FactoryProvider[];

  it("exposes publisher and subscriber tokens", () => {
    expect(Reflect.getMetadata("exports", DomainEventsModule)).toEqual([
      DOMAIN_EVENT_PUBLISHER,
      DOMAIN_EVENT_SUBSCRIBER,
    ]);
  });

  it("connects to REDIS_URL, defaulting to localhost", () => {
    process.env.REDIS_URL = "redis://prod-cache:6380";
    const [pub, sub] = providers();
    expect(pub!.useFactory()).toBeInstanceOf(RedisEventPublisher);
    expect(sub!.useFactory()).toBeInstanceOf(RedisEventSubscriber);
    expect(redis.instances.map((i) => i.url)).toEqual([
      "redis://prod-cache:6380",
      "redis://prod-cache:6380",
    ]);

    delete process.env.REDIS_URL;
    providers()[0]!.useFactory();
    expect(redis.instances.at(-1)!.url).toBe("redis://localhost:6379");
  });

  it("closes both connections on shutdown", async () => {
    const publisher = new RedisEventPublisher("redis://x");
    const subscriber = new RedisEventSubscriber("redis://x");
    const module = new DomainEventsModule(publisher, subscriber);

    await module.onModuleDestroy();

    expect(redis.instances.every((i) => i.quit.mock.calls.length === 1)).toBe(
      true,
    );
  });
});
