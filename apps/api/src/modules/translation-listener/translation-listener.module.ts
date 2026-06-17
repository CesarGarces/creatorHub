import { Module } from "@nestjs/common";
import { StorageModule } from "@creator-hub/storage";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { TranslationListenerService } from "./translation-listener.service";
import { WebsocketModule } from "../websocket/websocket.module";

@Module({
  imports: [DomainEventsModule, StorageModule, WebsocketModule],
  providers: [TranslationListenerService],
})
export class TranslationListenerModule {}
