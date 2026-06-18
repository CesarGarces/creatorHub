vi.mock("mercadopago", () => {
  const mockCreate = vi.fn().mockResolvedValue({
    id: "mp_pref_123",
    init_point: "https://www.mercadopago.com/checkout?pref_id=mp_pref_123",
  });
  const mockGet = vi.fn().mockResolvedValue({
    id: "mp_tx_123",
    status: "approved",
  });

  return {
    MercadoPagoConfig: vi.fn().mockImplementation(() => ({})),
    Preference: vi.fn().mockImplementation(() => ({ create: mockCreate })),
    Payment: vi.fn().mockImplementation(() => ({ get: mockGet })),
    __mocks: { mockCreate, mockGet },
  };
});

import { MercadoPagoStrategy } from "../mercado-pago.strategy";
import * as crypto from "crypto";

describe("MercadoPagoStrategy (webhook verification)", () => {
  const strategy = new MercadoPagoStrategy();

  afterEach(() => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.NODE_ENV;
  });

  it("validates HMAC signature using ts/v1 header and manifest", async () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const gatewayTxId = "mp_tx_123";
    const ts = Math.floor(Date.now() / 1000).toString();
    const manifest = `id:${gatewayTxId};ts:${ts};`;
    const v1 = crypto
      .createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
      .update(manifest)
      .digest("hex");
    const signatureHeader = `ts=${ts},v1=${v1}`;

    const body = { data: { id: gatewayTxId }, type: "payment" };
    const res = await strategy.verifyWebhook(
      { "x-signature": signatureHeader },
      body,
      Buffer.from("raw"),
    );

    expect(res.isValid).toBe(true);
    expect(res.gatewayTxId).toBe(gatewayTxId);
    expect(res.status).toBe("SUCCESSFUL");
  });

  it("falls back to API fetch when no secret but access token present", async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const gatewayTxId = "mp_tx_123";
    const body = { data: { id: gatewayTxId }, type: "payment" };

    const res = await strategy.verifyWebhook({}, body);
    expect(res.isValid).toBe(true);
    expect(res.gatewayTxId).toBe(gatewayTxId);
    expect(res.status).toBe("SUCCESSFUL");
  });

  it("accepts webhook when no secret and no access token (unverified)", async () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const body = { data: { id: "mp_tx_999" }, type: "payment" };
    const res = await strategy.verifyWebhook({}, body);
    expect(res.isValid).toBe(true);
    expect(res.status).toBe("PENDING");
  });

  it("rejects when signature header missing required parts", async () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const gatewayTxId = "mp_tx_123";
    const signatureHeader = `v1=deadbeef`;
    const body = { data: { id: gatewayTxId }, type: "payment" };
    const res = await strategy.verifyWebhook(
      { "x-signature": signatureHeader },
      body,
    );
    expect(res.isValid).toBe(false);
  });

  it("rejects when v1 does not match computed HMAC", async () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const gatewayTxId = "mp_tx_123";
    const ts = Math.floor(Date.now() / 1000).toString();
    const signatureHeader = `ts=${ts},v1=invalidhex`;
    const body = { data: { id: gatewayTxId }, type: "payment" };
    const res = await strategy.verifyWebhook(
      { "x-signature": signatureHeader },
      body,
    );
    expect(res.isValid).toBe(false);
  });

  it("rejects when body has no gateway tx id", async () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const ts = Math.floor(Date.now() / 1000).toString();
    const manifest = `id:;ts:${ts};`;
    const v1 = crypto
      .createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
      .update(manifest)
      .digest("hex");
    const signatureHeader = `ts=${ts},v1=${v1}`;
    const body = { foo: "bar" };
    const res = await strategy.verifyWebhook(
      { "x-signature": signatureHeader },
      body,
    );
    expect(res.isValid).toBe(false);
  });
});
