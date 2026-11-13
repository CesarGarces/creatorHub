import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/components/layout/top-bar", () => ({
  TopBar: () => <div data-testid="topbar" />,
}));

import api from "@/lib/api";
import CreditsPage from "@/components/credit-purchase/CreditPurchaseForm";
import { useCreditsStore } from "@/store/credits.store";
import { renderWithProviders } from "../test-utils";

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

const TRANSACTIONS = [
  {
    id: "t1",
    amount: 1000,
    type: "PURCHASE",
    description: "Starter pack",
    createdAt: "2026-01-02T10:00:00Z",
  },
  {
    id: "t2",
    amount: -10,
    type: "USAGE",
    description: null,
    createdAt: "2026-01-03T10:00:00Z",
  },
  {
    id: "t3",
    amount: 100,
    type: "BONUS",
    description: "Signup bonus",
    createdAt: "2026-01-01T10:00:00Z",
  },
];

function mockApi(transactions: unknown = TRANSACTIONS) {
  get.mockImplementation(async (url: string) => {
    if (url === "/credits/plans") return [];
    if (url === "/credits/transactions") return transactions;
    return [];
  });
}

const payButton = () =>
  screen.getByRole("button", { name: /Pay \$/ }) as HTMLButtonElement;
const amountInput = () =>
  document.querySelector('input[type="number"]') as HTMLInputElement;

async function openBuyModal() {
  fireEvent.click(screen.getByText("Buy More Credits"));
  await screen.findByText("Buy Credits");
}

describe("CreditPurchaseForm (credits page)", () => {
  const openMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useCreditsStore.setState({ balance: 1090 });
    vi.stubGlobal("open", openMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllGlobals());

  describe("balance and history", () => {
    it("shows the balance and lifetime credits earned (positive transactions only)", async () => {
      mockApi();
      renderWithProviders(<CreditsPage />);

      expect(screen.getByText(`⚡ ${(1090).toLocaleString()}`)).toBeTruthy();
      expect(
        await screen.findByText(
          `Lifetime: ${(1100).toLocaleString()} credits earned`,
        ),
      ).toBeTruthy();
    });

    it("uses the current balance as lifetime credits until history loads", () => {
      get.mockReturnValue(new Promise(() => {}));
      renderWithProviders(<CreditsPage />);

      expect(
        screen.getByText(`Lifetime: ${(1090).toLocaleString()} credits earned`),
      ).toBeTruthy();
      expect(screen.getByText("No transactions yet")).toBeTruthy();
    });

    it("lists transactions with signed amounts and a type fallback", async () => {
      mockApi();
      renderWithProviders(<CreditsPage />);

      expect(await screen.findByText("Starter pack")).toBeTruthy();
      expect(screen.getByText("+1000 credits")).toBeTruthy();
      expect(screen.getByText("-10 credits")).toBeTruthy();
      // A transaction without a description shows its type.
      expect(screen.getByText("USAGE")).toBeTruthy();
    });
  });

  describe("buying a custom amount", () => {
    beforeEach(() => mockApi([]));

    it("starts at the $10 minimum", async () => {
      renderWithProviders(<CreditsPage />);
      await openBuyModal();

      expect(amountInput().value).toBe("10");
      expect(payButton().textContent).toContain("Pay $10.00");
      expect(payButton().disabled).toBe(false);
    });

    it.each(["9.99", "0", ""])(
      "blocks amounts below $10 (%j)",
      async (value) => {
        renderWithProviders(<CreditsPage />);
        await openBuyModal();

        fireEvent.change(amountInput(), { target: { value } });
        fireEvent.click(payButton());

        expect(post).not.toHaveBeenCalled();
        if (value !== "") expect(payButton().disabled).toBe(true);
      },
    );

    it("creates a checkout, remembers the pending purchase and opens the gateway safely", async () => {
      post.mockResolvedValue({
        redirectUrl: "https://mp.example/pay/1",
        gatewayTxId: "mp-tx-1",
      });
      renderWithProviders(<CreditsPage />);
      await openBuyModal();

      fireEvent.change(amountInput(), { target: { value: "25" } });
      await act(async () => {
        fireEvent.click(payButton());
      });

      expect(post).toHaveBeenCalledWith("/credits/custom-checkout", {
        amount: 25,
      });
      expect(
        JSON.parse(localStorage.getItem("pendingCreditPurchase")!),
      ).toEqual({
        gatewayTxId: "mp-tx-1",
      });
      expect(openMock).toHaveBeenCalledWith(
        "https://mp.example/pay/1",
        "_blank",
        "noopener,noreferrer",
      );
      expect(screen.queryByText("Buy Credits")).toBeNull();
    });

    it("builds the MercadoPago URL from the preference id when no redirect is given", async () => {
      post.mockResolvedValue({ preferenceId: "pref-42" });
      renderWithProviders(<CreditsPage />);
      await openBuyModal();

      await act(async () => {
        fireEvent.click(payButton());
      });

      expect(openMock).toHaveBeenCalledWith(
        "https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref-42",
        "_blank",
        "noopener,noreferrer",
      );
      expect(localStorage.getItem("pendingCreditPurchase")).toBeNull();
    });

    it("keeps the dialog open when checkout fails", async () => {
      post.mockRejectedValue(new Error("gateway down"));
      renderWithProviders(<CreditsPage />);
      await openBuyModal();

      await act(async () => {
        fireEvent.click(payButton());
      });

      expect(openMock).not.toHaveBeenCalled();
      expect(screen.getByText("Buy Credits")).toBeTruthy();
      expect(payButton().disabled).toBe(false);
    });

    it("can be cancelled", async () => {
      renderWithProviders(<CreditsPage />);
      await openBuyModal();

      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByText("Buy Credits")).toBeNull();
    });
  });
});
