import { Module } from "@nestjs/common";
import { StorageModule } from "@creator-hub/storage";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { WebsocketModule } from "../websocket/websocket.module";
import { VideoListenerService } from "./video-listener.service";

@Module({
  imports: [StorageModule, DomainEventsModule, WebsocketModule],
  providers: [VideoListenerService],
})
export class VideoListenerModule {}
