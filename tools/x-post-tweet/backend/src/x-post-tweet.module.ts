import { Module } from "@nestjs/common";
import { BillingModule } from "@creator-hub/billing";
import { XPostTweetController } from "./x-post-tweet.controller";
import { PostPublisherService } from "./services/post-publisher.service";
import { XApiService } from "./services/x-api.service";

@Module({
  imports: [BillingModule],
  controllers: [XPostTweetController],
  providers: [PostPublisherService, XApiService],
  exports: [PostPublisherService, XApiService],
})
export class XPostTweetModule {}
