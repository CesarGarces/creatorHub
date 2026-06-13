import { Module, Global, OnModuleDestroy, Inject } from "@nestjs/common";
import { RedisEventPublisher } from "./redis-publisher";
import { RedisEventSubscriber } from "./redis-subscriber";
import { DOMAIN_EVENT_PUBLISHER, DOMAIN_EVENT_SUBSCRIBER } from "./tokens";

@Global()
@Module({
  providers: [
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useFactory: () => {
        const url = process.env.REDIS_URL || "redis://localhost:6379";
        return new RedisEventPublisher(url);
      },
    },
    {
      provide: DOMAIN_EVENT_SUBSCRIBER,
      useFactory: () => {
        const url = process.env.REDIS_URL || "redis://localhost:6379";
        return new RedisEventSubscriber(url);
      },
    },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER, DOMAIN_EVENT_SUBSCRIBER],
})
export class DomainEventsModule implements OnModuleDestroy {
  constructor(
    @Inject(DOMAIN_EVENT_PUBLISHER)
    private publisher: RedisEventPublisher,
    @Inject(DOMAIN_EVENT_SUBSCRIBER)
    private subscriber: RedisEventSubscriber
  ) {}

  async onModuleDestroy() {
    await this.publisher?.disconnect();
    await this.subscriber?.disconnect();
  }
}
