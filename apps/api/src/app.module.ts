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
import { ToolSdkModule } from "./tool-sdk.module";

import { AuthController } from "./modules/auth/auth.controller";
import { CreditsController } from "./modules/credits/credits.controller";
import { ToolsController } from "./modules/tools/tools.controller";
import { ImagesController } from "./modules/images/images.controller";
import { AdminController } from "./modules/admin/admin.controller";

// Import tools (registers them via registerTool)
import "@creator-hub/thumbnail-generator";
import { ThumbnailGeneratorModule } from "@creator-hub/thumbnail-generator-backend";

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
    ToolSdkModule,

    // Tools (registered automatically via ToolSdkModule)
    ThumbnailGeneratorModule,
  ],
  controllers: [
    AuthController,
    CreditsController,
    ToolsController,
    ImagesController,
    AdminController,
  ],
})
export class AppModule {}
