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
import { Payment } from "mercadopago";

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

  it("rejects webhook when no secret and no access token (unverifiable)", async () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN;
    const body = { data: { id: "mp_tx_999" }, type: "payment" };
    const res = await strategy.verifyWebhook({}, body);
    expect(res.isValid).toBe(false);
    expect(res.status).toBe("PENDING");
  });

  it("falls through to API when signature header is malformed", async () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const gatewayTxId = "mp_tx_123";
    const signatureHeader = `v1=deadbeef`;
    const body = { data: { id: gatewayTxId }, type: "payment" };

    const mockPaymentClient = {
      get: vi.fn().mockResolvedValue({ status: "approved" }),
    };
    (Payment as any).mockImplementation(() => mockPaymentClient);

    const res = await strategy.verifyWebhook(
      { "x-signature": signatureHeader },
      body,
    );
    expect(res.isValid).toBe(true);
    expect(res.status).toBe("SUCCESSFUL");
  });

  it("falls through to API when HMAC does not match", async () => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
    const gatewayTxId = "mp_tx_123";
    const ts = Math.floor(Date.now() / 1000).toString();
    const signatureHeader = `ts=${ts},v1=invalidhex`;
    const body = { data: { id: gatewayTxId }, type: "payment" };

    const mockPaymentClient = {
      get: vi.fn().mockResolvedValue({ status: "approved" }),
    };
    (Payment as any).mockImplementation(() => mockPaymentClient);

    const res = await strategy.verifyWebhook(
      { "x-signature": signatureHeader },
      body,
    );
    expect(res.isValid).toBe(true);
    expect(res.status).toBe("SUCCESSFUL");
  });

  it("acknowledges body with no gateway tx id", async () => {
    const body = { foo: "bar" };
    const res = await strategy.verifyWebhook({}, body);
    expect(res.isValid).toBe(true);
    expect(res.gatewayTxId).toBe("");
  });

  describe("mapPaymentStatus - MercadoPago status mapping", () => {
    it("maps 'approved' to SUCCESSFUL via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "approved" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_status_test" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("SUCCESSFUL");
    });

    it("maps 'rejected' to FAILED via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "rejected" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_rejected" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("FAILED");
    });

    it("maps 'pending' to PENDING via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "pending" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_pending" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("PENDING");
    });

    it("maps 'in_process' to PENDING via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "in_process" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_in_process" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("PENDING");
    });

    it("maps 'cancelled' to FAILED via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "cancelled" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_cancelled" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("FAILED");
    });

    it("maps 'expired' to FAILED via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "expired" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_expired" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("FAILED");
    });

    it("maps 'paid' to SUCCESSFUL via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "paid" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook({}, { data: { id: "mp_paid" } });

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("SUCCESSFUL");
    });

    it("returns PENDING for unknown status via API fetch", async () => {
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "unknown_status" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        {},
        { data: { id: "mp_unknown" } },
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("PENDING");
    });
  });

  describe("HMAC + API fetch integration", () => {
    it("fetches real payment status from API after HMAC verification", async () => {
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const gatewayTxId = "mp_hmac_api_1";
      const ts = Math.floor(Date.now() / 1000).toString();
      const manifest = `id:${gatewayTxId};ts:${ts};`;
      const v1 = crypto
        .createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
        .update(manifest)
        .digest("hex");

      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "approved" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        { "x-signature": `ts=${ts},v1=${v1}` },
        { data: { id: gatewayTxId }, type: "payment" },
        Buffer.from("raw"),
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("SUCCESSFUL");
      expect(mockPaymentClient.get).toHaveBeenCalledWith({ id: gatewayTxId });
    });

    it("returns FAILED when HMAC valid but payment is rejected", async () => {
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const gatewayTxId = "mp_hmac_rejected";
      const ts = Math.floor(Date.now() / 1000).toString();
      const manifest = `id:${gatewayTxId};ts:${ts};`;
      const v1 = crypto
        .createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
        .update(manifest)
        .digest("hex");

      const mockPaymentClient = {
        get: vi.fn().mockResolvedValue({ status: "rejected" }),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        { "x-signature": `ts=${ts},v1=${v1}` },
        { data: { id: gatewayTxId }, type: "payment" },
        Buffer.from("raw"),
      );

      expect(res.isValid).toBe(true);
      expect(res.status).toBe("FAILED");
    });

    it("rejects when API fetch fails even if HMAC is valid", async () => {
      process.env.MERCADO_PAGO_WEBHOOK_SECRET = "test-secret";
      process.env.MERCADO_PAGO_ACCESS_TOKEN = "fake-token";
      const gatewayTxId = "mp_hmac_api_fail";
      const ts = Math.floor(Date.now() / 1000).toString();
      const manifest = `id:${gatewayTxId};ts:${ts};`;
      const v1 = crypto
        .createHmac("sha256", process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
        .update(manifest)
        .digest("hex");

      const mockPaymentClient = {
        get: vi.fn().mockRejectedValue(new Error("API error")),
      };
      (Payment as any).mockImplementation(() => mockPaymentClient);

      const res = await strategy.verifyWebhook(
        { "x-signature": `ts=${ts},v1=${v1}` },
        { data: { id: gatewayTxId }, action: "payment.created" },
        Buffer.from("raw"),
      );

      expect(res.isValid).toBe(false);
      expect(res.status).toBe("PENDING");
    });
  });
});
