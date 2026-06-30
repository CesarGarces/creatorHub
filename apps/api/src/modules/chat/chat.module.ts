import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatRoutingService } from "./chat-routing.service";
import { ChatHistoryService } from "./chat-history.service";
import { ChatSettingsService } from "./chat-settings.service";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { ToolSdkModule } from "../../tool-sdk.module";
import { BillingModule } from "@creator-hub/billing";
import { UserStyleModule } from "../user-style/user-style.module";

@Module({
  imports: [AIEngineModule, ToolSdkModule, BillingModule, UserStyleModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatRoutingService,
    ChatHistoryService,
    ChatSettingsService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
