import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { CommunityBotModule as CommunityBotSharedModule } from "@creator-hub/community-bot";
import { COMMUNITY_CHANNEL_COMMAND_QUEUE } from "@creator-hub/shared-types";
import { WebsocketModule } from "../websocket/websocket.module";
import { CommunityBotController } from "./community-bot.controller";
import { CommunityBotListenerService } from "./community-bot.listener.service";
import { CommunityBotConfigService } from "./services/community-bot-config.service";
import { ChannelService } from "./services/channel.service";
import { ConversationService } from "./services/conversation.service";
import { PlaygroundService } from "./services/playground.service";

@Module({
  imports: [
    AIEngineModule,
    BillingModule,
    CommunityBotSharedModule,
    WebsocketModule,
    BullModule.registerQueue({ name: COMMUNITY_CHANNEL_COMMAND_QUEUE }),
  ],
  controllers: [CommunityBotController],
  providers: [
    CommunityBotConfigService,
    ChannelService,
    ConversationService,
    PlaygroundService,
    CommunityBotListenerService,
  ],
})
export class CommunityBotModule {}
