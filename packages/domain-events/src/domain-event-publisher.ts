export interface DomainEventPublisher {
  publish<T>(channel: string, event: T): Promise<void>;
}
