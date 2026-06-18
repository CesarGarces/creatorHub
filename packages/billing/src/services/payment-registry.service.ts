import { Injectable, BadRequestException, Inject } from "@nestjs/common";
import {
  IPaymentGateway,
  PaymentGateway,
} from "../interfaces/payment-gateway.interface";

@Injectable()
export class PaymentRegistryService {
  private readonly gateways = new Map<PaymentGateway, IPaymentGateway>();

  constructor(
    @Inject("PAYMENT_GATEWAYS") private readonly strategies: IPaymentGateway[],
  ) {
    (this.strategies || []).forEach((strategy) => {
      this.gateways.set(strategy.getGatewayType(), strategy);
    });
  }

  getGateway(type: PaymentGateway): IPaymentGateway {
    const gateway = this.gateways.get(type);
    if (!gateway) {
      throw new BadRequestException(
        `La pasarela de pago ${type} no está soportada.`,
      );
    }
    return gateway;
  }

  listSupported(): PaymentGateway[] {
    return Array.from(this.gateways.keys());
  }
}
