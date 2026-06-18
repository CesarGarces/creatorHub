import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import express from "express";
import bodyParser from "body-parser";
import type { Server } from "http";

// Start an express server with real endpoints
async function startApi() {
  const app = express();
  app.use(bodyParser.json());

  app.get("/api/v1/credits/plans", (_req, res) => {
    res.json([
      { id: "plan_basic", name: "Basic", priceCents: 500, credits: 50 },
    ]);
  });

  app.post("/api/v1/credits/checkout", (req, res) => {
    // simulate backend creating checkout and returning redirect
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "missing planId" });
    return res.json({
      redirectUrl: "https://checkout.example/123",
      gatewayTxId: "mp_pref_123",
    });
  });

  return new Promise<{ server: Server; url: string }>((resolve) => {
    const server = app.listen(0, () => {
      // @ts-expect-error testing mock
      const port = server.address().port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe("CreditPurchaseForm E2E", () => {
  let server: Server;
  let url: string;
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;

  beforeAll(async () => {
    const s = await startApi();
    server = s.server;
    url = s.url;
    process.env.NEXT_PUBLIC_API_URL = `${url}/api/v1`;
    // reload module cache for api client
    Object.keys(require.cache).forEach((k) => {
      if (k.includes("/apps/web/src/lib/api.ts")) delete require.cache[k];
    });
  });

  afterAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
    await new Promise((r) => server.close(() => r(null)));
  });

  it("fetches plans and redirects to checkout (real HTTP)", async () => {
    // import component after env is set
    const { default: CreditPurchaseForm } =
      await import("@/components/credit-purchase/CreditPurchaseForm");

    const originalLocation = window.location;
    // @ts-expect-error testing mock
    delete window.location;
    // @ts-expect-error testing mock
    window.location = { href: "" } as any;

    render(React.createElement(CreditPurchaseForm));

    expect(await screen.findByText("Comprar créditos")).toBeTruthy();
    const buyButton = await screen.findByText("Comprar");
    fireEvent.click(buyButton);

    // allow network + navigation
    await new Promise((r) => setTimeout(r, 100));

    expect(window.location.href).toBe("https://checkout.example/123");

    window.location = originalLocation;
  });
});
