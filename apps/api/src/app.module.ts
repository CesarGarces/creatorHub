import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { join } from "path";

import { AuthModule } from "@creator-hub/auth";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { StorageModule } from "@creator-hub/storage";
import { AnalyticsModule } from "@creator-hub/analytics";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { STTEngineModule } from "@creator-hub/stt-engine";
import { ToolSdkModule } from "./tool-sdk.module";

import { AuthController } from "./modules/auth/auth.controller";
import { CreditsController } from "./modules/credits/credits.controller";
import { ToolsController } from "./modules/tools/tools.controller";
import { ImagesController } from "./modules/images/images.controller";
import { AdminModule } from "./modules/admin/admin.module";
import { AIController } from "./modules/ai/ai.controller";
import { WebhooksController } from "./modules/webhooks/webhooks.controller";

import { WebsocketModule } from "./modules/websocket/websocket.module";
import { ThumbnailListenerModule } from "./modules/thumbnail-listener/thumbnail-listener.module";
import { TranslationListenerModule } from "./modules/translation-listener/translation-listener.module";
import { PaymentListenerModule } from "./modules/payment-listener/payment-listener.module";
import { VideoListenerModule } from "./modules/video-listener/video-listener.module";
import { ChatModule } from "./modules/chat/chat.module";

// Import tools (registers them via registerTool)
import "@creator-hub/thumbnail-generator";
import { ThumbnailGeneratorModule } from "@creator-hub/thumbnail-generator-backend";
import "@creator-hub/content-translator";
import { ContentTranslatorModule } from "@creator-hub/content-translator-backend";
import "@creator-hub/video-generator";
import { VideoGeneratorModule } from "@creator-hub/video-generator-backend";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(process.cwd(), "../../.env"),
    }),
    BullModule.forRoot({
      connection: process.env.REDIS_URL
        ? { url: process.env.REDIS_URL }
        : {
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379"),
          },
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    // Core packages
    AuthModule,
    AIEngineModule,
    BillingModule,
    StorageModule,
    AnalyticsModule,
    DomainEventsModule,
    STTEngineModule,
    ToolSdkModule,
    AdminModule,

    // WebSocket + event listeners
    WebsocketModule,
    ThumbnailListenerModule,
    TranslationListenerModule,
    PaymentListenerModule,
    VideoListenerModule,

    // Chat
    ChatModule,

    // Tools (registered automatically via ToolSdkModule)
    ThumbnailGeneratorModule,
    ContentTranslatorModule,
    VideoGeneratorModule,
  ],
  controllers: [
    AuthController,
    CreditsController,
    ToolsController,
    ImagesController,
    AIController,
    WebhooksController,
  ],
})
export class AppModule {}
