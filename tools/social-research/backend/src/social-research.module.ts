import { Module } from "@nestjs/common";
import { SocialResearchService } from "./social-research.service";
import { SocialResearchController } from "./social-research.controller";
import { TrendCacheService } from "./cache.service";

@Module({
  controllers: [SocialResearchController],
  providers: [SocialResearchService, TrendCacheService],
  exports: [SocialResearchService, TrendCacheService],
})
export class SocialResearchModule {}
