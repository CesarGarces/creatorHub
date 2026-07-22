import { Module } from "@nestjs/common";
import { BillingModule } from "@creator-hub/billing";
import { SocialResearchModule } from "@creator-hub/social-research-backend";
import { XPostTweetModule } from "@creator-hub/x-post-tweet-backend";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { AnalyticsModule } from "@creator-hub/analytics";
import { XSearchTrendsService } from "./x-search-trends.service";
import { XSearchTrendsController } from "./x-search-trends.controller";
import { SocialService } from "./services/social.service";
import { OAuthEncryptionService } from "./services/oauth-encryption.service";
import { TweetAnalysisService } from "./services/tweet-analysis.service";
import { ApifyService } from "./services/apify.service";

@Module({
  imports: [
    BillingModule,
    SocialResearchModule,
    XPostTweetModule,
    AIEngineModule,
    AnalyticsModule,
  ],
  controllers: [XSearchTrendsController],
  providers: [
    XSearchTrendsService,
    SocialService,
    OAuthEncryptionService,
    TweetAnalysisService,
    ApifyService,
  ],
  exports: [XSearchTrendsService],
})
export class XSearchTrendsModule {}
