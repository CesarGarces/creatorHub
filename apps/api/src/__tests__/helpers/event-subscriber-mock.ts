import { vi } from "vitest";

type Handler = (event: never) => unknown;

/**
 * Fake DomainEventSubscriber that records handlers so tests can publish
 * events the same way Redis pub/sub would deliver them.
 */
export function createEventSubscriberMock() {
  const handlers = new Map<string, Handler>();

  return {
    handlers,
    subscribe: vi.fn(async (channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
    unsubscribe: vi.fn(async (channel: string) => {
      handlers.delete(channel);
    }),
    /** Delivers `event` to the handler subscribed on `channel`. */
    async publish(channel: string, event: unknown): Promise<void> {
      const handler = handlers.get(channel);
      if (!handler) throw new Error(`No handler subscribed to "${channel}"`);
      await handler(event as never);
    },
  };
}
