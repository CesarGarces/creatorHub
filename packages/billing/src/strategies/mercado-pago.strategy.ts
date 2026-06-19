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
          metadata: {
            user_id: data.userId,
            credits: data.creditsToBuy,
          },
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

  private extractGatewayTxId(body: any): string {
    // New webhook format: { data: { id: "123" } }
    if (body?.data?.id) return String(body.data.id);

    // Old IPN format: { resource: "123", topic: "payment" }
    if (body?.topic === "payment" && body?.resource) {
      const r = String(body.resource);
      if (/^\d+$/.test(r)) return r;
    }

    // Old IPN format: { resource: "https://api.mercadolibre.com/merchant_orders/...", topic: "merchant_order" }
    if (body?.resource && typeof body.resource === "string") {
      const match = body.resource.match(/\/(\d+)(?:\?|$)/);
      if (match) return match[1];
    }

    // Fallback: body.id, body.payment_id
    if (body?.id && typeof body.id === "string" && /^\d+$/.test(body.id)) {
      return body.id;
    }
    if (body?.payment_id) return String(body.payment_id);

    return "";
  }

  async verifyWebhook(
    headers: any,
    body: any,
    _rawBody?: Buffer,
  ): Promise<WebhookVerificationResult> {
    try {
      const gatewayTxId = this.extractGatewayTxId(body);
      const secret =
        process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
        process.env.MP_WEBHOOK_SECRET;

      this.logger.log(
        `verifyWebhook: gatewayTxId=${gatewayTxId}, bodyType=${body?.topic || body?.type || "unknown"}, hasSecret=${!!secret}`,
      );

      // If no gatewayTxId extracted, this is a notification we can't process (e.g. merchant_order)
      if (!gatewayTxId) {
        this.logger.log(
          `No extractable payment ID from webhook (topic=${body?.topic}). Acknowledging.`,
        );
        return {
          isValid: true,
          gatewayTxId: "",
          status: "PENDING",
          metadata: { note: "non-payment webhook, acknowledged" },
        };
      }

      // 1) Preferred: HMAC signature verification
      const signatureHeader =
        headers["x-signature"] ||
        headers["x-meli-signature"] ||
        headers["x-mercadopago-signature"] ||
        headers["x-hub-signature"];

      let hmacVerified = false;

      if (secret && signatureHeader) {
        const parts = String(signatureHeader)
          .split(",")
          .map((p) => p.trim());
        const tsPart = parts.find((p) => p.startsWith("ts="));
        const v1Part = parts.find((p) => p.startsWith("v1="));
        const ts = tsPart ? tsPart.split("=")[1] : undefined;
        const v1 = v1Part ? v1Part.split("=")[1] : undefined;

        if (ts && v1) {
          const manifest = `id:${gatewayTxId};ts:${ts};`;
          const computed = crypto
            .createHmac("sha256", secret)
            .update(manifest)
            .digest("hex");
          const compBuf = Buffer.from(computed, "hex");
          const v1Buf = Buffer.from(v1, "hex");
          let sigValid =
            compBuf.length === v1Buf.length &&
            crypto.timingSafeEqual(compBuf, v1Buf);
          if (!sigValid) {
            sigValid = computed === v1;
          }

          if (sigValid) {
            hmacVerified = true;
            this.logger.log(`HMAC signature verified for ${gatewayTxId}`);
          } else {
            this.logger.warn(
              `HMAC signature invalid for ${gatewayTxId}. Falling back to API verification.`,
            );
          }
        } else {
          this.logger.warn(
            "Malformed signature header (missing ts or v1). Falling back to API.",
          );
        }
      } else if (!secret) {
        this.logger.warn(
          "No MERCADO_PAGO_WEBHOOK_SECRET configured. Using API verification only.",
        );
      } else {
        this.logger.warn(
          "No signature header present. Using API verification only.",
        );
      }

      // 2) Always verify via MercadoPago API (primary method, or fallback if HMAC failed)
      const client = this.getClient();
      if (client) {
        try {
          const paymentClient = new Payment(client);
          const payment = await paymentClient.get({ id: gatewayTxId });
          const paymentAny = payment as any;
          const mpStatus = (
            paymentAny?.status ||
            paymentAny?.collection_status ||
            ""
          )
            .toString()
            .toLowerCase();
          const status = this.mapPaymentStatus(mpStatus);
          this.logger.log(
            `API verification for ${gatewayTxId}: mpStatus=${mpStatus} -> ${status}, hmacVerified=${hmacVerified}`,
          );
          return {
            isValid: true,
            gatewayTxId,
            status,
            metadata: {
              method: hmacVerified ? "HMAC_API" : "API_FETCH",
              mpStatus,
              hmacVerified,
              raw: body,
              payment,
            },
          };
        } catch (err) {
          this.logger.error(`API fetch failed for ${gatewayTxId}`, err as any);
          return {
            isValid: false,
            gatewayTxId,
            status: "PENDING",
            metadata: {
              method: "API_FETCH_FAILED",
              hmacVerified,
              error: (err as any)?.message,
            },
          };
        }
      }

      // 3) No API client configured — accept if HMAC was valid
      if (hmacVerified) {
        this.logger.log(
          `HMAC verified but no API client. Accepting webhook for ${gatewayTxId}.`,
        );
        return {
          isValid: true,
          gatewayTxId,
          status: "PENDING",
          metadata: { method: "HMAC_ONLY", hmacVerified: true },
        };
      }

      // 4) Nothing worked — reject
      this.logger.warn(
        `Cannot verify webhook for ${gatewayTxId}: no HMAC, no API client.`,
      );
      return {
        isValid: false,
        gatewayTxId,
        status: "PENDING",
        metadata: { note: "unverifiable" },
      };
    } catch (err) {
      this.logger.error("Error verifying Mercado Pago webhook", err as any);
      return { isValid: false, gatewayTxId: "", status: "PENDING" };
    }
  }

  private mapPaymentStatus(
    paymentStatus: string,
  ): WebhookVerificationResult["status"] {
    if (!paymentStatus) return "PENDING";
    const s = paymentStatus.toString().toLowerCase();
    if (s === "approved" || s === "paid") return "SUCCESSFUL";
    if (s === "rejected" || s === "cancelled" || s === "expired")
      return "FAILED";
    // in_process, pending, authorized, in_mediation, refunded, charged_back
    return "PENDING";
  }
}
