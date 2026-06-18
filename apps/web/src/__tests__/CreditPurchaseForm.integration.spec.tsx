import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CreditPurchaseForm from "@/components/credit-purchase/CreditPurchaseForm";

vi.mock("@/lib/api", () => ({
  default: {
    get: vi
      .fn()
      .mockResolvedValue([
        { id: "plan_basic", name: "Basic", priceCents: 500, credits: 50 },
      ]),
    post: vi.fn().mockResolvedValue({
      redirectUrl: "https://checkout.example/123",
      gatewayTxId: "mp_pref_123",
    }),
  },
}));

describe("CreditPurchaseForm integration", () => {
  it("fetches plans and redirects on buy", async () => {
    const originalLocation = window.location;
    // @ts-expect-error testing mock
    delete window.location;
    // @ts-expect-error testing mock
    window.location = { href: "" } as any;

    render(<CreditPurchaseForm />);

    expect(await screen.findByText("Comprar créditos")).toBeTruthy();
    const buyButton = await screen.findByText("Comprar");
    fireEvent.click(buyButton);

    // allow promises to resolve
    await new Promise((r) => setTimeout(r, 50));

    expect(window.location.href).toBe("https://checkout.example/123");

    // restore
    window.location = originalLocation;
  });
});
