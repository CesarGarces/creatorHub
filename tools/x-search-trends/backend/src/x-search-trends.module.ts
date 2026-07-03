import { Module } from "@nestjs/common";
import { BillingModule } from "@creator-hub/billing";
import { SocialResearchModule } from "@creator-hub/social-research-backend";
import { XPostTweetModule } from "@creator-hub/x-post-tweet-backend";
import { XSearchTrendsService } from "./x-search-trends.service";
import { XSearchTrendsController } from "./x-search-trends.controller";
import { SocialService } from "./services/social.service";
import { OAuthEncryptionService } from "./services/oauth-encryption.service";
import { TwitterCrawlerService } from "./services/twitter-crawler.service";

@Module({
  imports: [BillingModule, SocialResearchModule, XPostTweetModule],
  controllers: [XSearchTrendsController],
  providers: [
    XSearchTrendsService,
    SocialService,
    OAuthEncryptionService,
    TwitterCrawlerService,
  ],
  exports: [XSearchTrendsService],
})
export class XSearchTrendsModule {}
