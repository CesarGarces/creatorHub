import { Module } from "@nestjs/common";
import { ContentPlannerController } from "./content-planner.controller";
import { ContentPlannerService } from "./content-planner.service";
import { ContentPlannerReminderService } from "./reminder.service";
import { ContentPlannerAssistantActions } from "./assistant-actions";

/**
 * The calendar. `ContentPlannerAssistantActions` registers what the AI
 * assistant may do here (create a session, read the agenda) in the global
 * AssistantActionRegistry — when there is none (tests), it does nothing.
 */
@Module({
  controllers: [ContentPlannerController],
  providers: [
    ContentPlannerService,
    ContentPlannerReminderService,
    ContentPlannerAssistantActions,
  ],
  exports: [ContentPlannerService, ContentPlannerReminderService],
})
export class ContentPlannerModule {}
