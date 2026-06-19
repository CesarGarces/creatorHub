import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as crypto from "crypto";
import {
  IPaymentGateway,
  CreateCheckoutDto,
  CheckoutResponse,
  WebhookVerificationResult,
  PaymentGateway,
} from "../interfaces/payment-gateway.interface";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

@Injectable()
export class MercadoPagoStrategy implements IPaymentGateway {
  private readonly logger = new Logger(MercadoPagoStrategy.name);

  getGatewayType(): PaymentGateway {
    return PaymentGateway.MERCADO_PAGO;
  }

  private getClient() {
    const accessToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!accessToken) return null;
    return new MercadoPagoConfig({ accessToken });
  }

  async createCheckoutSession(
    data: CreateCheckoutDto,
  ): Promise<CheckoutResponse> {
    const client = this.getClient();
    if (!client) {
      if (process.env.NODE_ENV === "production") {
        this.logger.error(
          "MERCADO_PAGO_ACCESS_TOKEN not configured in production",
        );
        throw new ServiceUnavailableException("Payment gateway not configured");
      }
      this.logger.warn(
        "MERCADO_PAGO_ACCESS_TOKEN not configured; falling back to stubbed URL",
      );
      const gatewayTxId = `mp_pref_${crypto.randomUUID()}`;
      const paymentUrl = `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${gatewayTxId}`;
      return { paymentUrl, gatewayTxId };
    }

    try {
      const preference = new Preference(client);

      const notificationUrl =
        process.env.MP_NOTIFICATION_URL ||
        (process.env.API_URL
          ? `${process.env.API_URL.replace(/\/$/, "")}/api/v1/webhooks/mercado-pago`
          : undefined);

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

      const resp = await preference.create({
        body: {
          items: [
            {
              id: `credits_${data.creditsToBuy}`,
              title: data.description,
              quantity: 1,
              currency_id: data.currency,
              unit_price: Number(data.amount),
            },
          ],
          external_reference: data.userId,
          ...(notificationUrl ? { notification_url: notificationUrl } : {}),
          back_urls: {
            success: `${frontendUrl}/credits`,
            failure: `${frontendUrl}/credits`,
            pending: `${frontendUrl}/credits`,
          },
        },
      });

      const gatewayTxId =
        (resp as any).id?.toString() || `mp_pref_${crypto.randomUUID()}`;
      const paymentUrl =
        (resp as any).init_point ||
        (resp as any).sandbox_init_point ||
        `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${gatewayTxId}`;

      this.logger.log(
        `MercadoPago preference created ${gatewayTxId} for user ${data.userId}`,
      );

      const preferenceId = (resp as any).id?.toString() || gatewayTxId;

      return { paymentUrl, gatewayTxId, preferenceId };
    } catch (err) {
      this.logger.error(
        "Mercado Pago SDK error creating preference",
        err as any,
      );
      if (process.env.NODE_ENV === "production") {
        throw new ServiceUnavailableException(
          "Could not create Mercado Pago preference",
        );
      }
      const gatewayTxId = `mp_pref_${crypto.randomUUID()}`;
      const paymentUrl = `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${gatewayTxId}`;
      return { paymentUrl, gatewayTxId };
    }
  }

  async verifyWebhook(
    headers: any,
    body: any,
    _rawBody?: Buffer,
  ): Promise<WebhookVerificationResult> {
    try {
      const gatewayTxId =
        body?.data?.id || body?.id || body?.resource?.id || "";
      const secret =
        process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
        process.env.MP_WEBHOOK_SECRET;

      // 1) Preferred: HMAC signature verification
      const signatureHeader =
        headers["x-signature"] ||
        headers["x-meli-signature"] ||
        headers["x-mercadopago-signature"] ||
        headers["x-hub-signature"];

      if (secret && signatureHeader) {
        const parts = String(signatureHeader)
          .split(",")
          .map((p) => p.trim());
        const tsPart = parts.find((p) => p.startsWith("ts="));
        const v1Part = parts.find((p) => p.startsWith("v1="));
        const ts = tsPart ? tsPart.split("=")[1] : undefined;
        const v1 = v1Part ? v1Part.split("=")[1] : undefined;

        if (!ts || !v1 || !gatewayTxId) {
          this.logger.warn(
            "Malformed signature header or missing gateway transaction id",
          );
          return { isValid: false, gatewayTxId: "", status: "PENDING" };
        }

        if (ts && v1 && gatewayTxId) {
          const manifest = `id:${gatewayTxId};ts:${ts};`;
          const computed = crypto
            .createHmac("sha256", secret)
            .update(manifest)
            .digest("hex");
          const compBuf = Buffer.from(computed, "hex");
          const v1Buf = Buffer.from(v1, "hex");
          let isValid =
            compBuf.length === v1Buf.length &&
            crypto.timingSafeEqual(compBuf, v1Buf);
          if (!isValid) {
            isValid = computed === v1;
          }
          if (!isValid) {
            this.logger.warn(
              `Firma de webhook inválida para tx ${gatewayTxId}`,
            );
            return { isValid: false, gatewayTxId: "", status: "PENDING" };
          }

          const status = this.mapStatus(
            body?.action || body?.type || body?.topic || "",
          );
          return {
            isValid: true,
            gatewayTxId,
            status,
            metadata: { method: "HMAC", raw: body },
          };
        }
      }

      // 2) Fallback: verify via Mercado Pago API
      const client = this.getClient();
      if (client && gatewayTxId) {
        try {
          const paymentClient = new Payment(client);
          const payment = await paymentClient.get({ id: gatewayTxId });
          const statusStr = (
            (payment as any)?.status ||
            (payment as any)?.collection_status ||
            ""
          )
            .toString()
            .toLowerCase();
          const status =
            statusStr.includes("approved") || statusStr.includes("paid")
              ? "SUCCESSFUL"
              : statusStr.includes("rejected")
                ? "FAILED"
                : "PENDING";
          return {
            isValid: true,
            gatewayTxId,
            status,
            metadata: { method: "API_FETCH", payment },
          };
        } catch (err) {
          this.logger.warn("SDK verification failed", err as any);
          return {
            isValid: true,
            gatewayTxId,
            status: "PENDING",
            metadata: {
              method: "API_FETCH_FAILED",
              note: "test webhook or invalid ID",
            },
          };
        }
      }

      // 3) No secret or test webhook — accept
      this.logger.warn(
        "Webhook accepted without strict verification (no secret or no signature header)",
      );
      return {
        isValid: true,
        gatewayTxId,
        status: "PENDING",
        metadata: {
          note: "unverified — configure MERCADO_PAGO_WEBHOOK_SECRET for production",
        },
      };
    } catch (err) {
      this.logger.error("Error verifying Mercado Pago webhook", err as any);
      return { isValid: false, gatewayTxId: "", status: "PENDING" };
    }
  }

  private mapStatus(action: string): WebhookVerificationResult["status"] {
    if (!action) return "PENDING";
    const clean = action.toString().toLowerCase();
    if (clean.includes("opened") || clean.includes("created")) return "PENDING";
    if (
      clean.includes("payment") ||
      clean.includes("approved") ||
      clean.includes("paid")
    )
      return "SUCCESSFUL";
    if (clean.includes("rejected") || clean.includes("cancelled"))
      return "FAILED";
    return "PENDING";
  }
}
