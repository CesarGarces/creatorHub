import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { AnalyticsModule } from "@creator-hub/analytics";
import { BillingModule } from "@creator-hub/billing";
import { AiPlannerController } from "./ai-planner.controller";
import { AiPlannerService } from "./ai-planner.service";
import { KnowledgeIndexService } from "./knowledge-index.service";

/**
 * AI planning assistant of the Content Planner (its own module so the
 * calendar itself stays free of AI/billing dependencies). ToolRegistry
 * comes from the global ToolSdkModule.
 */
@Module({
  imports: [AIEngineModule, BillingModule, AnalyticsModule],
  controllers: [AiPlannerController],
  providers: [AiPlannerService, KnowledgeIndexService],
  exports: [AiPlannerService, KnowledgeIndexService],
})
export class ContentPlannerAiModule {}
