import { Module } from "@nestjs/common";
import { SharingController } from "./sharing.controller";
import { SharingService } from "./sharing.service";
import { StorageModule } from "@creator-hub/storage";

@Module({
  imports: [StorageModule],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
