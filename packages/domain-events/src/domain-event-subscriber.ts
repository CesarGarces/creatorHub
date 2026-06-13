export type EventHandler<T = unknown> = (event: T) => Promise<void> | void;

export interface DomainEventSubscriber {
  subscribe<T>(channel: string, handler: EventHandler<T>): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
}
