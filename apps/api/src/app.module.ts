import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { APP_GUARD } from "@nestjs/core";
import { join } from "path";

import { SentryModule } from "./common/sentry";
import { IdempotencyModule } from "./common/idempotency/idempotency.module";
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
import { AIModule } from "./modules/ai/ai.module";
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
import { CommunityBotModule } from "./modules/community-bot/community-bot.module";

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
import "@creator-hub/script-writer";
import { ScriptWriterModule } from "@creator-hub/script-writer-backend";

// Redis storage for rate limiting: limits stay consistent across replicas
// and restarts (in-memory storage would multiply the effective limit per
// instance). Redis is already a hard dependency of this app (BullMQ, events).
const throttlerStorage = process.env.REDIS_URL
  ? new ThrottlerStorageRedisService(process.env.REDIS_URL)
  : new ThrottlerStorageRedisService({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    });

@Module({
  imports: [
    // Sentry MUST be first — captures errors in all subsequent modules
    SentryModule,
    IdempotencyModule,

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
    // Rate limiting (SEC-04). The guard is registered globally below — without
    // APP_GUARD this config alone protects nothing.
    // Default: 60 req/min per IP. Stricter per-endpoint limits live on
    // AuthController via @Throttle(). Webhooks skip throttling (@SkipThrottle)
    // so payment gateway retries are never rejected.
    ThrottlerModule.forRoot({
      throttlers: [{ name: "default", ttl: 60_000, limit: 60 }],
      storage: throttlerStorage,
    }),

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
    AIModule,

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

    // Community bot (auto-replies to the creator's community channels)
    CommunityBotModule,

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
    ScriptWriterModule,
  ],
  controllers: [
    AuthController,
    CreditsController,
    ToolsController,
    ToolFavoritesController,
    ImagesController,
    WebhooksController,
  ],
  providers: [
    // ThrottlerGuard runs BEFORE PlanGuard: cheap rejection of abusive
    // traffic before any database work happens.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PlanGuard,
    },
    ToolFavoritesService,
  ],
})
export class AppModule {}
