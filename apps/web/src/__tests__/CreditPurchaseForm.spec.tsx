import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CreditPurchaseForm from "@/components/credit-purchase/CreditPurchaseForm";
import { vi } from "vitest";

vi.mock("@/lib/api", () => {
  return {
    default: {
      get: vi
        .fn()
        .mockResolvedValue([
          { id: "p1", name: "Starter", priceCents: 500, credits: 50 },
        ]),
      post: vi
        .fn()
        .mockResolvedValue({ redirectUrl: "https://example.com/checkout" }),
    },
  };
});

describe("CreditPurchaseForm", () => {
  it("renders plans and starts checkout", async () => {
    render(<CreditPurchaseForm />);

    expect(screen.getByText(/Loading plans/i)).toBeTruthy();

    await waitFor(() => expect(screen.getByText(/Starter/)).toBeTruthy());

    const buy = screen.getByRole("button", { name: /Comprar/i });

    // prevent jsdom navigation by mocking window.location
    const origLocation = window.location;
    // @ts-expect-error testing mock
    delete window.location;
    // @ts-expect-error testing mock
    window.location = { href: "" };

    fireEvent.click(buy);

    // since we mocked post to return redirectUrl, ensure button becomes disabled
    await waitFor(() => expect((buy as HTMLButtonElement).disabled).toBe(true));

    // restore
    // @ts-expect-error testing mock
    window.location = origLocation;
  });
});
