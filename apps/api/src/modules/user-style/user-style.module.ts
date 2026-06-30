import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { UserStyleController } from "./user-style.controller";
import { StyleProfileService } from "./services/style-profile.service";
import { StyleAnalyzerService } from "./services/style-analyzer.service";
import { StyleInjectionService } from "./services/style-injection.service";
import { ContentSampleService } from "./services/content-sample.service";

@Module({
  imports: [AIEngineModule, BillingModule],
  controllers: [UserStyleController],
  providers: [
    StyleProfileService,
    StyleAnalyzerService,
    StyleInjectionService,
    ContentSampleService,
  ],
  exports: [StyleInjectionService, StyleProfileService],
})
export class UserStyleModule {}
