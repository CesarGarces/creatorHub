import { Module } from "@nestjs/common";
import { ContentPlannerController } from "./content-planner.controller";
import { ContentPlannerService } from "./content-planner.service";
import { ContentPlannerReminderService } from "./reminder.service";

@Module({
  controllers: [ContentPlannerController],
  providers: [ContentPlannerService, ContentPlannerReminderService],
  exports: [ContentPlannerService, ContentPlannerReminderService],
})
export class ContentPlannerModule {}
