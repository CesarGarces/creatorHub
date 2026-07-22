import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { StorageModule } from "@creator-hub/storage";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { AnalyticsModule } from "@creator-hub/analytics";
import { ThumbnailService } from "./thumbnail.service";
import { ThumbnailController } from "./thumbnail.controller";
import { ThumbnailProcessor } from "./thumbnail.processor";
import { MarketingEventService } from "./use-cases/marketing-event.service";

@Module({
  imports: [
    AIEngineModule,
    BillingModule,
    StorageModule,
    DomainEventsModule,
    AnalyticsModule,
    BullModule.registerQueue({
      name: "thumbnail-generation",
    }),
  ],
  controllers: [ThumbnailController],
  providers: [ThumbnailService, ThumbnailProcessor, MarketingEventService],
  exports: [ThumbnailService],
})
export class ThumbnailGeneratorModule {}
