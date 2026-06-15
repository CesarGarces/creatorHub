import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CreditService } from "./credit.service";
import { BillingService } from "./billing.service";
import { CreditProcessor } from "./credit.processor";
import { MarketingEventHandler } from "./marketing-event.handler";

@Module({
  imports: [
    BullModule.registerQueue({ name: "credits" }),
    EventEmitterModule.forRoot(),
  ],
  providers: [CreditService, BillingService, CreditProcessor, MarketingEventHandler],
  exports: [CreditService, BillingService],
})
export class BillingModule {}
