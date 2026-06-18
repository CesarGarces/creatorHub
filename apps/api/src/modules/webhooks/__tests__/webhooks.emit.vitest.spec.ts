import { describe, it, expect, beforeAll, vi } from "vitest";
import express from "express";
import bodyParser from "body-parser";
import request from "supertest";
import { WebhooksController } from "../webhooks.controller";

describe("Webhooks -> CreditBilling -> Gateway emit", () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    // attach raw body
    const rawBodySaver = (req: any, _res: any, buf: Buffer) => {
      if (buf && buf.length) req.rawBody = buf;
    };
    app.use(bodyParser.json({ verify: rawBodySaver }));

    // Mock event publisher that should be called by CreditBillingService
    const mockEventPublisher = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    // Mock CreditBillingService that calls the event publisher when reconciliation succeeds
    const mockCreditBilling = {
      reconcilePayment: async (_gateway: any, verification: any, _raw: any) => {
        if (verification?.isValid && verification?.status === "SUCCESSFUL") {
          const userId =
            (_raw &&
              (_raw.external_reference || _raw.data?.external_reference)) ||
            "unknown-user";
          await mockEventPublisher.publish("payment:success", {
            userId,
            gatewayTxId: verification.gatewayTxId,
            amount: _raw?.amount || 0,
            balance: 0,
            gateway: _gateway,
            timestamp: new Date(),
          });
          return true;
        }
        return false;
      },
    } as any;

    // Mock strategy returned by PaymentRegistryService
    const mockStrategy = {
      verifyWebhook: async (_headers: any, _body: any, _raw: any) => {
        return {
          isValid: true,
          status: "SUCCESSFUL",
          gatewayTxId: "mp_test_1",
        };
      },
    } as any;

    const mockPaymentRegistry = {
      getGateway: (_g: any) => mockStrategy,
    } as any;

    const controller = new WebhooksController(
      mockPaymentRegistry as any,
      mockCreditBilling as any,
    );

    app.post("/webhooks/:gateway", (req, res) =>
      controller.handle(req.params.gateway, req as any, res as any, req.body),
    );
    // expose mocks for assertions via app locals
    (app as any).locals = { mockEventPublisher };
  });

  it("invokes event publisher via reconcilePayment", async () => {
    const res = await request(app)
      .post("/webhooks/mercado-pago")
      .send({ external_reference: "user-1", amount: 100 })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    // @ts-expect-error testing mock
    const { mockEventPublisher } = (app as any).locals;
    expect(mockEventPublisher.publish).toHaveBeenCalledWith(
      "payment:success",
      expect.objectContaining({
        userId: "user-1",
        gatewayTxId: "mp_test_1",
      }),
    );
  });
});
