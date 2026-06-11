import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { CreditService } from "./credit.service";
import { BillingService } from "./billing.service";
import { CreditProcessor } from "./credit.processor";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "credits",
    }),
  ],
  providers: [CreditService, BillingService, CreditProcessor],
  exports: [CreditService, BillingService],
})
export class BillingModule {}
