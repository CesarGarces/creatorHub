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

  constructor(
    private readonly paymentRegistry: PaymentRegistryService,
    private readonly creditBilling: CreditBillingService,
  ) {}

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

      if (!verification.isValid) {
        this.logger.warn("Webhook verification failed", verification);
        // Return 200 to prevent MercadoPago from retrying indefinitely
        return res.send({ ok: true, warning: "verification_failed" });
      }

      // Process all statuses: SUCCESSFUL (add credits), FAILED (notify), PENDING (notify)
      const ok = await this.creditBilling.reconcilePayment(
        gatewayEnum as any,
        verification as any,
        body || rawBody,
      );
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
