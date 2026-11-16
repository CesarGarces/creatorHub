import { Module } from "@nestjs/common";
import { ContentPlannerModule } from "@creator-hub/content-planner-backend";
import { NotificationModule } from "../notification/notification.module";
import { WebsocketModule } from "../websocket/websocket.module";
import { ContentPlannerRemindersService } from "./content-planner-reminders.service";

/** Sends "your session starts soon" notifications for the Content Planner. */
@Module({
  imports: [ContentPlannerModule, NotificationModule, WebsocketModule],
  providers: [ContentPlannerRemindersService],
})
export class ContentPlannerRemindersModule {}
