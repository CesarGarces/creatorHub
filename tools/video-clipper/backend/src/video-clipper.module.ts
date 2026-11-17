import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { AnalyticsModule } from "@creator-hub/analytics";
import { BillingModule } from "@creator-hub/billing";
import { VideoClipperController } from "./video-clipper.controller";
import { VideoClipperService } from "./video-clipper.service";

/**
 * AI Video Analyzer & Smart Clipper. No storage module on purpose: videos
 * and keyframes stay in the user's browser — only the JSON result is kept.
 */
@Module({
  imports: [AIEngineModule, BillingModule, AnalyticsModule],
  controllers: [VideoClipperController],
  providers: [VideoClipperService],
  exports: [VideoClipperService],
})
export class VideoClipperModule {}
