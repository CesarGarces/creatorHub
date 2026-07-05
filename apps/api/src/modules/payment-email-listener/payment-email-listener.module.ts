import { Module } from "@nestjs/common";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { EmailModule } from "@creator-hub/email";
import { PaymentEmailListenerService } from "./payment-email-listener.service";

@Module({
  imports: [DomainEventsModule, EmailModule],
  providers: [PaymentEmailListenerService],
})
export class PaymentEmailListenerModule {}
