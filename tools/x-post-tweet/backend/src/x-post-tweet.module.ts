import { Module } from "@nestjs/common";
import { BillingModule } from "@creator-hub/billing";
import { AnalyticsModule } from "@creator-hub/analytics";
import { XPostTweetController } from "./x-post-tweet.controller";
import { PostPublisherService } from "./services/post-publisher.service";
import { XApiService } from "./services/x-api.service";

@Module({
  imports: [BillingModule, AnalyticsModule],
  controllers: [XPostTweetController],
  providers: [PostPublisherService, XApiService],
  exports: [PostPublisherService, XApiService],
})
export class XPostTweetModule {}
