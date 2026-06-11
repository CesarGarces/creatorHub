import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AnalyticsService } from "./analytics.service";
import { UsageTracker } from "./usage.tracker";

@Module({
  imports: [BullModule.registerQueue({ name: "analytics" })],
  providers: [AnalyticsService, UsageTracker],
  exports: [AnalyticsService, UsageTracker],
})
export class AnalyticsModule {}
