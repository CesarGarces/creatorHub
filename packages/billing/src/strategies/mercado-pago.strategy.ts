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
import * as mercadopago from "mercadopago";

@Injectable()
export class MercadoPagoStrategy implements IPaymentGateway {
  private readonly logger = new Logger(MercadoPagoStrategy.name);

  getGatewayType(): PaymentGateway {
    return PaymentGateway.MERCADO_PAGO;
  }

  async createCheckoutSession(
    data: CreateCheckoutDto,
  ): Promise<CheckoutResponse> {
    // Configure SDK with access token
    const accessToken =
      process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
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
      if (mercadopago.configurations.setAccessToken) {
        mercadopago.configurations.setAccessToken(accessToken);
      } else {
        (mercadopago as any).configure({ access_token: accessToken });
      }

      const preference: any = {
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
        notification_url:
          process.env.MP_NOTIFICATION_URL ||
          (process.env.API_URL &&
            `${process.env.API_URL.replace(/\/$/, "")}/api/v1/webhooks/mercado-pago`),
        back_urls: {
          success:
            process.env.FRONTEND_URL || "https://app.creatorhub.local/success",
          failure:
            process.env.FRONTEND_URL || "https://app.creatorhub.local/failure",
        },
        auto_return: "approved",
      };

      const resp: any = await mercadopago.preferences.create(preference);
      const pref = resp && resp.body ? resp.body : resp;
      const gatewayTxId = pref.id || `mp_pref_${crypto.randomUUID()}`;
      const paymentUrl =
        pref.init_point ||
        pref.sandbox_init_point ||
        `https://www.mercadopago.com/checkout/v1/redirect?pref_id=${gatewayTxId}`;

      this.logger.log(
        `MercadoPago preference created ${gatewayTxId} for user ${data.userId}`,
      );

      return { paymentUrl, gatewayTxId };
    } catch (err) {
      this.logger.error(
        "Mercado Pago SDK error creating preference",
        err as any,
      );
      // In production, surface as Service Unavailable so UI can handle gracefully
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

      // 1) Preferred: HMAC signature verification using provided secret and header 'x-signature'
      const signatureHeader =
        headers["x-signature"] ||
        headers["x-meli-signature"] ||
        headers["x-mercadopago-signature"] ||
        headers["x-hub-signature"];

      if (secret && signatureHeader) {
        // Signature may be like: "ts=1718642940,v1=abcdef..."
        const parts = String(signatureHeader)
          .split(",")
          .map((p) => p.trim());
        const tsPart = parts.find((p) => p.startsWith("ts="));
        const v1Part = parts.find((p) => p.startsWith("v1="));
        const ts = tsPart ? tsPart.split("=")[1] : undefined;
        const v1 = v1Part ? v1Part.split("=")[1] : undefined;

        // if signature header present but missing required pieces, fail fast
        if (!ts || !v1 || !gatewayTxId) {
          this.logger.warn(
            "Malformed signature header or missing gateway transaction id",
          );
          return { isValid: false, gatewayTxId: "", status: "PENDING" };
        }

        if (ts && v1 && gatewayTxId) {
          // Manifest recommended: join id and timestamp in a deterministic way
          const manifest = `id:${gatewayTxId};ts:${ts};`;
          const computed = crypto
            .createHmac("sha256", secret)
            .update(manifest)
            .digest("hex");
          // debug logging removed
          // compare as raw hex bytes
          const compBuf = Buffer.from(computed, "hex");
          const v1Buf = Buffer.from(v1, "hex");
          let isValid =
            compBuf.length === v1Buf.length &&
            crypto.timingSafeEqual(compBuf, v1Buf);
          // fallback to direct string equality for compatibility with alternate encodings
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

      // 2) Fallback: verify via Mercado Pago API (best-effort) when access token is configured
      const accessToken =
        process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN;
      if (accessToken && gatewayTxId) {
        try {
          if (mercadopago.configurations.setAccessToken) {
            mercadopago.configurations.setAccessToken(accessToken);
          } else {
            (mercadopago as any).configure({ access_token: accessToken });
          }

          const paymentResp: any = await (mercadopago.payment
            ? mercadopago.payment.get(gatewayTxId)
            : (mercadopago as any).payments.get(gatewayTxId));
          const payment =
            paymentResp && paymentResp.body ? paymentResp.body : paymentResp;
          const statusStr = (
            payment?.status ||
            payment?.collection_status ||
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
          return { isValid: false, gatewayTxId: "", status: "PENDING" };
        }
      }

      // 3) Development: allow processing when not in production (for ease of local testing)
      if (process.env.NODE_ENV !== "production") {
        this.logger.warn(
          "Processing Mercado Pago webhook without strict verification (dev mode)",
        );
        return {
          isValid: true,
          gatewayTxId,
          status: "SUCCESSFUL",
          metadata: { dev: true },
        };
      }

      // If we reached here, we could not verify
      return { isValid: false, gatewayTxId: "", status: "PENDING" };
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
    if (
      clean.includes("rejected") ||
      clean.includes("cancelled") ||
      clean.includes("cancelled")
    )
      return "FAILED";
    return "PENDING";
  }
}
