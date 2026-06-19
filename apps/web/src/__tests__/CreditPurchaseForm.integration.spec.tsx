import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders } from "./test-utils";
import CreditsPage from "@/components/credit-purchase/CreditPurchaseForm";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

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

const mockCheckout = vi.fn().mockResolvedValue({
  redirectUrl: "https://mp.com/checkout",
  gatewayTxId: "mp_123",
});

vi.mock("@/hooks/useCheckout", () => ({
  default: vi.fn(() => ({
    checkout: mockCheckout,
    loadingPlanId: null,
  })),
}));

import api from "@/lib/api";

describe("CreditPurchaseForm integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads plans and shows them on screen", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/credits/plans")
        return Promise.resolve([
          { id: "p1", name: "Starter", usdAmount: 25, creditsGiven: 2700 },
        ]);
      if (url === "/credits/transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderWithProviders(<CreditsPage />);

    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeTruthy();
    });
  });

  it("opens buy modal and calls API on Pay button", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/credits/plans") return Promise.resolve([]);
      if (url === "/credits/transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    (api.post as any).mockResolvedValue({
      redirectUrl: "https://mp.com/pay",
      gatewayTxId: "mp_456",
    });

    renderWithProviders(<CreditsPage />);

    fireEvent.click(screen.getByText("Buy More Credits"));

    await waitFor(() => {
      expect(screen.getByText("Buy Credits")).toBeTruthy();
    });

    const payButton = screen.getByRole("button", { name: /Pay \$/i });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/credits/custom-checkout", {
        amount: 10,
      });
    });
  });
});
