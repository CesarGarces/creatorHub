import { Module } from "@nestjs/common";
import { BillingModule } from "@creator-hub/billing";
import { SocialResearchModule } from "@creator-hub/social-research-backend";
import { XSearchTrendsService } from "./x-search-trends.service";
import { XSearchTrendsController } from "./x-search-trends.controller";
import { ApifyService } from "./services/apify.service";

@Module({
  imports: [BillingModule, SocialResearchModule],
  controllers: [XSearchTrendsController],
  providers: [XSearchTrendsService, ApifyService],
  exports: [XSearchTrendsService],
})
export class XSearchTrendsModule {}
