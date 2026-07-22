import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { AnalyticsModule } from "@creator-hub/analytics";
import { ContentTranslatorController } from "./content-translator.controller";
import { ContentTranslatorService } from "./content-translator.service";
import { ContentTranslatorProcessor } from "./content-translator.processor";

@Module({
  imports: [
    AIEngineModule,
    BillingModule,
    DomainEventsModule,
    AnalyticsModule,
    BullModule.registerQueue({ name: "translation" }),
  ],
  controllers: [ContentTranslatorController],
  providers: [ContentTranslatorService, ContentTranslatorProcessor],
  exports: [ContentTranslatorService],
})
export class ContentTranslatorModule {}
