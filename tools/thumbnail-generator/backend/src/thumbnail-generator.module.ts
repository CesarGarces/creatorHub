import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { StorageModule } from "@creator-hub/storage";
import { ThumbnailService } from "./thumbnail.service";
import { ThumbnailController } from "./thumbnail.controller";
import { ThumbnailProcessor } from "./thumbnail.processor";

@Module({
  imports: [
    AIEngineModule,
    BillingModule,
    StorageModule,
    BullModule.registerQueue({
      name: "thumbnail-generation",
    }),
  ],
  controllers: [ThumbnailController],
  providers: [ThumbnailService, ThumbnailProcessor],
  exports: [ThumbnailService],
})
export class ThumbnailGeneratorModule {}
