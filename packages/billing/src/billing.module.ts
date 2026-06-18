import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DomainEventsModule } from "@creator-hub/domain-events";
import { CreditService } from "./credit.service";
import { BillingService } from "./billing.service";
import { CreditProcessor } from "./credit.processor";
import { MarketingEventHandler } from "./marketing-event.handler";
import { MercadoPagoStrategy } from "./strategies/mercado-pago.strategy";
import { PaymentRegistryService } from "./services/payment-registry.service";
import { CreditBillingService } from "./services/credit-billing.service";

const PAYMENT_GATEWAYS = "PAYMENT_GATEWAYS";

@Module({
  imports: [
    BullModule.registerQueue({ name: "credits" }),
    EventEmitterModule.forRoot(),
    DomainEventsModule,
  ],
  providers: [
    // existing billing services
    CreditService,
    BillingService,
    CreditProcessor,
    MarketingEventHandler,

    // Payment strategies and registry
    MercadoPagoStrategy,
    {
      provide: PAYMENT_GATEWAYS,
      useFactory: (mp: MercadoPagoStrategy) => [mp],
      inject: [MercadoPagoStrategy],
    },
    PaymentRegistryService,
    // Reconciliation service
    CreditBillingService,
  ],
  exports: [
    CreditService,
    BillingService,
    PaymentRegistryService,
    CreditBillingService,
  ],
})
export class BillingModule {}
