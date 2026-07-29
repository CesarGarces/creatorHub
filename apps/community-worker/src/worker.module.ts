import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { join } from "path";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { CommunityBotModule } from "@creator-hub/community-bot";
import {
  COMMUNITY_INBOUND_QUEUE,
  COMMUNITY_OUTBOUND_QUEUE,
  COMMUNITY_CHANNEL_COMMAND_QUEUE,
} from "@creator-hub/shared-types";
import { ChannelManagerService } from "./channel-manager.service";
import { CommunityGuardService } from "./services/community-guard.service";
import { ReplyGeneratorService } from "./services/reply-generator.service";
import { InboundProcessor } from "./processors/inbound.processor";
import { OutboundProcessor } from "./processors/outbound.processor";
import { ChannelCommandProcessor } from "./processors/channel-command.processor";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), "../../.env"),
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379", 10),
          },
    }),
    BullModule.registerQueue(
      { name: COMMUNITY_INBOUND_QUEUE },
      { name: COMMUNITY_OUTBOUND_QUEUE },
      { name: COMMUNITY_CHANNEL_COMMAND_QUEUE },
    ),
    AIEngineModule,
    BillingModule,
    DomainEventsModule,
    CommunityBotModule,
  ],
  providers: [
    ChannelManagerService,
    CommunityGuardService,
    ReplyGeneratorService,
    InboundProcessor,
    OutboundProcessor,
    ChannelCommandProcessor,
  ],
})
export class WorkerModule {}
