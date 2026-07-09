import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { join } from "path";

import { SentryModule } from "./common/sentry";
import { AuthModule } from "@creator-hub/auth";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { BillingModule } from "@creator-hub/billing";
import { StorageModule } from "@creator-hub/storage";
import { AnalyticsModule } from "@creator-hub/analytics";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { STTEngineModule } from "@creator-hub/stt-engine";
import { EmailModule } from "@creator-hub/email";
import { ToolSdkModule } from "./tool-sdk.module";
import { PlanGuard } from "@creator-hub/auth";

import { AuthController } from "./modules/auth/auth.controller";
import { CreditsController } from "./modules/credits/credits.controller";
import { ToolsController } from "./modules/tools/tools.controller";
import { ToolFavoritesController } from "./modules/tools/tool-favorites.controller";
import { ToolFavoritesService } from "./modules/tools/tool-favorites.service";
import { ImagesController } from "./modules/images/images.controller";
import { AdminModule } from "./modules/admin/admin.module";
import { AIController } from "./modules/ai/ai.controller";
import { WebhooksController } from "./modules/webhooks/webhooks.controller";
import { SharingModule } from "./modules/sharing/sharing.module";
import { NotificationModule } from "./modules/notification/notification.module";

import { WebsocketModule } from "./modules/websocket/websocket.module";
import { ThumbnailListenerModule } from "./modules/thumbnail-listener/thumbnail-listener.module";
import { TranslationListenerModule } from "./modules/translation-listener/translation-listener.module";
import { PaymentListenerModule } from "./modules/payment-listener/payment-listener.module";
import { PaymentEmailListenerModule } from "./modules/payment-email-listener/payment-email-listener.module";
import { VideoListenerModule } from "./modules/video-listener/video-listener.module";
import { ChatModule } from "./modules/chat/chat.module";
import { UserStyleModule } from "./modules/user-style/user-style.module";
import { SocialModule } from "./modules/social/social.module";

// Import tools (registers them via registerTool)
import "@creator-hub/thumbnail-generator";
import { ThumbnailGeneratorModule } from "@creator-hub/thumbnail-generator-backend";
import "@creator-hub/content-translator";
import { ContentTranslatorModule } from "@creator-hub/content-translator-backend";
import "@creator-hub/video-generator";
import { VideoGeneratorModule } from "@creator-hub/video-generator-backend";
import "@creator-hub/x-search-trends";
import { XSearchTrendsModule } from "@creator-hub/x-search-trends-backend";
import { SocialResearchModule } from "@creator-hub/social-research-backend";
import "@creator-hub/x-post-tweet";
import { XPostTweetModule } from "@creator-hub/x-post-tweet-backend";

@Module({
  imports: [
    // Sentry MUST be first — captures errors in all subsequent modules
    SentryModule,

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
    EmailModule,
    ToolSdkModule,
    AdminModule,

    // WebSocket + event listeners
    WebsocketModule,
    ThumbnailListenerModule,
    TranslationListenerModule,
    PaymentListenerModule,
    PaymentEmailListenerModule,
    VideoListenerModule,

    // Chat
    ChatModule,
    UserStyleModule,
    SocialModule,

    // Sharing (public asset viewing)
    SharingModule,

    // Notifications
    NotificationModule,

    // Tools (registered automatically via ToolSdkModule)
    ThumbnailGeneratorModule,
    ContentTranslatorModule,
    VideoGeneratorModule,
    XSearchTrendsModule,
    XPostTweetModule,
    SocialResearchModule,
  ],
  controllers: [
    AuthController,
    CreditsController,
    ToolsController,
    ToolFavoritesController,
    ImagesController,
    AIController,
    WebhooksController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: PlanGuard,
    },
    ToolFavoritesService,
  ],
})
export class AppModule {}
