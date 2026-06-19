import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import * as bodyParser from "body-parser";

import { WebhooksController } from "../webhooks.controller";
import { PaymentGateway } from "@creator-hub/billing";

describe("WebhooksController (express integration)", () => {
  let server: any;
  let mockPaymentRegistry: any;
  let mockCreditBilling: any;
  let mockVerify: any;

  beforeAll(() => {
    mockVerify = vi.fn().mockResolvedValue({
      isValid: true,
      gatewayTxId: "mp_tx_123",
      status: "SUCCESSFUL",
    });
    mockPaymentRegistry = {
      getGateway: vi.fn().mockReturnValue({ verifyWebhook: mockVerify }),
    };
    mockCreditBilling = { reconcilePayment: vi.fn().mockResolvedValue(true) };

    const controller = new WebhooksController(
      mockPaymentRegistry as any,
      mockCreditBilling as any,
    );

    const app = express();
    app.use(
      bodyParser.json({
        verify: (req: any, _res, buf) => {
          req.rawBody = buf;
        },
      }),
    );

    app.post("/webhooks/mercado-pago", (req, res) => {
      // call controller.handle directly
      return (controller as any).handle("mercado-pago", req, res, req.body);
    });

    server = app;
  });

  it("accepts valid webhook and triggers reconciliation with correct args", async () => {
    const payload = { data: { id: "mp_tx_123" } };
    const res = await request(server)
      .post("/webhooks/mercado-pago")
      .set("Content-Type", "application/json")
      // craft a dummy signature header matching expected format; verification is mocked
      .set("x-signature", "ts=123,v1=deadbeef")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    expect(mockPaymentRegistry.getGateway).toHaveBeenCalledTimes(1);
    expect(mockPaymentRegistry.getGateway).toHaveBeenCalledWith(
      PaymentGateway.MERCADO_PAGO,
    );

    expect(mockCreditBilling.reconcilePayment).toHaveBeenCalledTimes(1);
    const callArgs = (mockCreditBilling.reconcilePayment as any).mock.calls[0];
    expect(callArgs[0]).toBe(PaymentGateway.MERCADO_PAGO);
    expect(callArgs[1]).toEqual({
      isValid: true,
      gatewayTxId: "mp_tx_123",
      status: "SUCCESSFUL",
    });
    expect(callArgs[2]).toEqual(payload);
  });

  it("rejects invalid signature but returns 200 to prevent MP retries", async () => {
    // arrange: next verification will be invalid
    mockVerify.mockResolvedValueOnce({ isValid: false });
    const payload = { data: { id: "mp_tx_123" } };
    const res = await request(server)
      .post("/webhooks/mercado-pago")
      .set("Content-Type", "application/json")
      .set("x-signature", "ts=123,v1=bad")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, warning: "verification_failed" });
  });
});
