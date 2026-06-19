import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require("express") as any;
import type { Server } from "http";
import { renderWithProviders } from "./test-utils";

vi.mock("@/components/layout/top-bar", () => ({
  TopBar: () => <div data-testid="topbar" />,
}));

vi.mock("@/store/credits.store", () => ({
  useCreditsStore: Object.assign(
    vi.fn(() => ({
      balance: 0,
      freeCredits: 0,
      purchasedCredits: 0,
      plan: "FREE",
      isLoading: false,
      error: null,
    })),
    {
      getState: vi.fn(() => ({
        balance: 0,
        freeCredits: 0,
        purchasedCredits: 0,
        plan: "FREE",
        isLoading: false,
        error: null,
      })),
    },
  ),
}));

vi.mock("@/hooks/useCheckout", () => ({
  default: vi.fn(() => ({
    checkout: vi.fn(),
    loadingPlanId: null,
  })),
}));

async function startApi() {
  const app = express();
  app.use(express.json());

  app.get("/api/v1/credits/plans", (_req: any, res: any) => {
    res.json([
      { id: "plan_basic", name: "Basic", usdAmount: 10, creditsGiven: 1000 },
    ]);
  });

  app.get("/api/v1/credits/transactions", (_req: any, res: any) => {
    res.json([]);
  });

  app.post("/api/v1/credits/custom-checkout", (req: any, res: any) => {
    const { amount } = req.body;
    if (!amount || amount < 10)
      return res.status(400).json({ error: "minimum $10" });
    return res.json({
      redirectUrl: "https://checkout.example/123",
      gatewayTxId: "mp_pref_123",
    });
  });

  return new Promise<{ server: Server; url: string }>((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
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
  });

  afterAll(async () => {
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
    await new Promise((r) => server.close(() => r(null)));
  });

  it("loads plans from real API and opens buy modal", async () => {
    // Must import after env is set and cache is cleared
    vi.resetModules();
    const { default: CreditsPage } =
      await import("@/components/credit-purchase/CreditPurchaseForm");

    renderWithProviders(<CreditsPage />);

    await waitFor(() => {
      expect(screen.getByText("Basic")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("Buy More Credits"));

    await waitFor(() => {
      expect(screen.getByText("Buy Credits")).toBeTruthy();
    });
  });
});
