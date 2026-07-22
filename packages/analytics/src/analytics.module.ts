import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AnalyticsService } from "./analytics.service";
import { UsageTracker } from "./usage.tracker";
import { PlatformUsageLogger } from "./platform-usage-logger";

@Module({
  imports: [BullModule.registerQueue({ name: "analytics" })],
  providers: [AnalyticsService, UsageTracker, PlatformUsageLogger],
  exports: [AnalyticsService, UsageTracker, PlatformUsageLogger],
})
export class AnalyticsModule {}
