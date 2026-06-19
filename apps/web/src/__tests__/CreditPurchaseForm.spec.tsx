import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
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
      balance: 500,
      freeCredits: 100,
      purchasedCredits: 400,
      plan: "STARTER",
      isLoading: false,
      error: null,
    })),
    {
      getState: vi.fn(() => ({
        balance: 500,
        freeCredits: 100,
        purchasedCredits: 400,
        plan: "STARTER",
        isLoading: false,
        error: null,
      })),
    },
  ),
}));

vi.mock("@/hooks/useCheckout", () => ({
  default: vi.fn(() => ({
    checkout: vi
      .fn()
      .mockResolvedValue({ redirectUrl: "https://mp.com/checkout" }),
    loadingPlanId: null,
  })),
}));

import api from "@/lib/api";

describe("CreditPurchaseForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders balance and buy button", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/credits/plans") return Promise.resolve([]);
      if (url === "/credits/transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderWithProviders(<CreditsPage />);

    expect(screen.getByText("Current Balance")).toBeTruthy();
    expect(screen.getByText("Buy More Credits")).toBeTruthy();
  });

  it("displays plans from API", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/credits/plans")
        return Promise.resolve([
          { id: "p1", name: "Starter", usdAmount: 25, creditsGiven: 2700 },
          { id: "p2", name: "Pro", usdAmount: 50, creditsGiven: 6000 },
        ]);
      if (url === "/credits/transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderWithProviders(<CreditsPage />);

    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeTruthy();
      expect(screen.getByText("Pro")).toBeTruthy();
    });
  });

  it("opens buy credits modal when clicking Buy More Credits", async () => {
    (api.get as any).mockImplementation((url: string) => {
      if (url === "/credits/plans") return Promise.resolve([]);
      if (url === "/credits/transactions") return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderWithProviders(<CreditsPage />);

    fireEvent.click(screen.getByText("Buy More Credits"));

    await waitFor(() => {
      expect(screen.getByText("Buy Credits")).toBeTruthy();
      expect(screen.getByText(/Enter the amount in dollars/i)).toBeTruthy();
    });
  });
});
