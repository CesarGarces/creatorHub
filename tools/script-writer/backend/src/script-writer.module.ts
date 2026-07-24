import { Module } from "@nestjs/common";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { AnalyticsModule } from "@creator-hub/analytics";
import { ScriptWriterController } from "./script-writer.controller";
import { ScriptWriterService } from "./script-writer.service";
import { StyleInjectionService } from "./style-injection.service";

@Module({
  imports: [AIEngineModule, BillingModule, AnalyticsModule],
  controllers: [ScriptWriterController],
  providers: [ScriptWriterService, StyleInjectionService],
  exports: [ScriptWriterService],
})
export class ScriptWriterModule {}
