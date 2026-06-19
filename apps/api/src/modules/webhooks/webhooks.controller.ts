import {
  Controller,
  Post,
  Param,
  Req,
  Res,
  Logger,
  HttpCode,
  HttpStatus,
  Body,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  PaymentRegistryService,
  CreditBillingService,
  PaymentGateway,
} from "@creator-hub/billing";

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  // In-flight dedup: payment IDs currently being processed
  private readonly processing = new Map<string, number>();

  constructor(
    private readonly paymentRegistry: PaymentRegistryService,
    private readonly creditBilling: CreditBillingService,
  ) {}

  private isProcessing(gatewayTxId: string): boolean {
    if (!gatewayTxId) return false;
    const ts = this.processing.get(gatewayTxId);
    if (!ts) return false;
    // Expire after 30s (safety net)
    if (Date.now() - ts > 30_000) {
      this.processing.delete(gatewayTxId);
      return false;
    }
    return true;
  }

  private markProcessing(gatewayTxId: string) {
    if (gatewayTxId) this.processing.set(gatewayTxId, Date.now());
  }

  private markDone(gatewayTxId: string) {
    if (gatewayTxId) this.processing.delete(gatewayTxId);
  }

  @Post(":gateway")
  @HttpCode(HttpStatus.OK)
  async handle(
    @Param("gateway") gateway: string,
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: any,
  ) {
    // raw body attached by body-parser verify
    const rawBody = (req as any).rawBody as Buffer | undefined;
    const headers = req.headers || {};

    this.logger.log(
      `Webhook received: gateway=${gateway}, hasRawBody=${!!rawBody}, bodyKeys=${JSON.stringify(Object.keys(body || {}))}, body=${JSON.stringify(body)?.slice(0, 500)}`,
    );

    // Map gateway path segment to PaymentGateway enum value (e.g. 'mercado-pago' -> MERCADO_PAGO)
    const gwKey = gateway.toUpperCase().replace(/-/g, "_");
    const gatewayEnum = (PaymentGateway as any)[gwKey] as PaymentGateway;
    if (!gatewayEnum) {
      this.logger.warn(`Unsupported gateway path: ${gateway}`);
      return res.status(400).send({ ok: false });
    }

    try {
      const strategy = this.paymentRegistry.getGateway(gatewayEnum as any);
      const verification = await (strategy as any).verifyWebhook(
        headers,
        body,
        rawBody,
      );

      this.logger.log(
        `Verification result: isValid=${verification.isValid}, status=${verification.status}, gatewayTxId=${verification.gatewayTxId}`,
      );

      if (!verification.isValid) {
        this.logger.warn("Webhook verification failed", verification);
        // Return 200 to prevent MercadoPago from retrying indefinitely
        return res.send({ ok: true, warning: "verification_failed" });
      }

      const gatewayTxId = verification.gatewayTxId;

      // Deduplicate: skip if this payment ID is already being processed
      if (this.isProcessing(gatewayTxId)) {
        this.logger.log(
          `Skipping duplicate webhook for payment ${gatewayTxId} (already processing)`,
        );
        return res.send({ ok: true, status: "duplicate" });
      }
      this.markProcessing(gatewayTxId);

      // Process all statuses: SUCCESSFUL (add credits), FAILED (notify), PENDING (notify)
      let ok = false;
      try {
        ok = await this.creditBilling.reconcilePayment(
          gatewayEnum as any,
          verification as any,
          body || rawBody,
        );
      } finally {
        this.markDone(gatewayTxId);
      }

      this.logger.log(`Reconcile result: ok=${ok}`);

      if (!ok) {
        this.logger.warn("Reconciliation failed for webhook", verification);
        return res.status(500).send({ ok: false });
      }

      return res.send({ ok: true, status: verification.status });
    } catch (err) {
      this.logger.error("Error handling webhook", err as any);
      return res.status(500).send({ ok: false });
    }
  }
}
