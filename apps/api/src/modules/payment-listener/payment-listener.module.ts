import { Module } from "@nestjs/common";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { WebsocketModule } from "../websocket/websocket.module";
import { PaymentListenerService } from "./payment-listener.service";

@Module({
  imports: [DomainEventsModule, WebsocketModule],
  providers: [PaymentListenerService],
})
export class PaymentListenerModule {}
