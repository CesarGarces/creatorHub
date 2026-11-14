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

@Module({
  imports: [AuthModule, StorageModule, AIEngineModule, CreditEmailsModule],
  controllers: [AdminController, AdminAuthController],
  providers: [AdminService, DatabaseBackupService, CreditEmailTriggerService],
  exports: [AdminService, DatabaseBackupService],
})
export class AdminModule {}
