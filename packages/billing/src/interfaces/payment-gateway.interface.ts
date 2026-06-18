export enum PaymentGateway {
  MERCADO_PAGO = "MERCADO_PAGO",
  PAYPAL = "PAYPAL",
}

export type Currency = "COP" | "USD";

export interface CreateCheckoutDto {
  userId: string;
  amount: number;
  currency: Currency;
  creditsToBuy: number;
  description: string;
}

export interface CheckoutResponse {
  paymentUrl: string; // URL to redirect the user
  gatewayTxId: string; // unique id from the gateway
  preferenceId?: string; // MercadoPago preference id for embedded checkout
}

export interface WebhookVerificationResult {
  isValid: boolean;
  gatewayTxId: string;
  status: "SUCCESSFUL" | "FAILED" | "PENDING";
  metadata?: Record<string, any>;
}

export interface IPaymentGateway {
  getGatewayType(): PaymentGateway;
  createCheckoutSession(data: CreateCheckoutDto): Promise<CheckoutResponse>;
  // rawBody is optional Buffer containing the original request bytes (preferred for HMAC verification)
  verifyWebhook(
    headers: any,
    body: any,
    rawBody?: Buffer,
  ): Promise<WebhookVerificationResult>;
}
