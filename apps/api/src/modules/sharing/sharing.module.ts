import { Module } from "@nestjs/common";
import { SharingController } from "./sharing.controller";
import { SharingService } from "./sharing.service";
import { StorageModule } from "@creator-hub/storage";
import { NotificationModule } from "../notification/notification.module";
import { WebsocketModule } from "../websocket/websocket.module";

@Module({
  imports: [StorageModule, NotificationModule, WebsocketModule],
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
