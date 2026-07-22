import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { StorageModule } from "@creator-hub/storage";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { AnalyticsModule } from "@creator-hub/analytics";
import { VideoService } from "./video.service";
import { VideoController } from "./video.controller";
import { VideoProcessor } from "./video.processor";
import { MarketingEventService } from "./use-cases/marketing-event.service";

@Module({
  imports: [
    AIEngineModule,
    BillingModule,
    StorageModule,
    DomainEventsModule,
    AnalyticsModule,
    BullModule.registerQueue({ name: "video-generation" }),
  ],
  controllers: [VideoController],
  providers: [VideoService, VideoProcessor, MarketingEventService],
  exports: [VideoService],
})
export class VideoGeneratorModule {}
