import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminService } from "./admin.service";
import { DatabaseBackupService } from "./database-backup.service";
import { CreditEmailTriggerService } from "./credit-email-trigger.service";
import { CreditEmailsModule } from "../credit-emails/credit-emails.module";
import { AuthModule } from "@creator-hub/auth";
import { StorageModule } from "@creator-hub/storage";
import { AIEngineModule } from "@creator-hub/ai-engine";
import { TTSEngineModule } from "@creator-hub/tts-engine";
import { VoiceSettingsModule } from "@creator-hub/voice-settings";
import { AdminVoiceSettingsController } from "./admin-voice-settings.controller";

@Module({
  imports: [
    AuthModule,
    StorageModule,
    AIEngineModule,
    CreditEmailsModule,
    TTSEngineModule,
    VoiceSettingsModule,
  ],
  controllers: [
    AdminController,
    AdminAuthController,
    AdminVoiceSettingsController,
  ],
  providers: [AdminService, DatabaseBackupService, CreditEmailTriggerService],
  exports: [AdminService, DatabaseBackupService],
})
export class AdminModule {}
