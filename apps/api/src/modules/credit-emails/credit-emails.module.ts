import { Module } from "@nestjs/common";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { EmailModule } from "@creator-hub/email";
import { CreditEmailService } from "./credit-email.service";
import { CreditEmailListenerService } from "./credit-email-listener.service";

@Module({
  imports: [DomainEventsModule, EmailModule],
  providers: [CreditEmailService, CreditEmailListenerService],
  exports: [CreditEmailService],
})
export class CreditEmailsModule {}
