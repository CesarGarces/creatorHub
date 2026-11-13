import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const mp = vi.hoisted(() => ({
  initMercadoPago: vi.fn(),
  walletProps: [] as unknown[],
}));

vi.mock("@mercadopago/sdk-react", () => ({
  initMercadoPago: mp.initMercadoPago,
  Wallet: (props: unknown) => {
    mp.walletProps.push(props);
    return <div data-testid="mp-wallet" />;
  },
}));

/** CheckoutModal reads NEXT_PUBLIC_MP_PUBLIC_KEY at import time. */
async function loadCheckoutModal(publicKey: string | undefined) {
  vi.resetModules();
  if (publicKey === undefined) delete process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  else process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = publicKey;
  return (await import("@/components/billing/CheckoutModal")).CheckoutModal;
}

describe("CheckoutModal", () => {
  const originalKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const baseProps = { planName: "Starter", price: "$9.99" };

  beforeEach(() => {
    mp.initMercadoPago.mockClear();
    mp.walletProps = [];
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_MP_PUBLIC_KEY = originalKey;
  });

  it("renders nothing when closed", async () => {
    const CheckoutModal = await loadCheckoutModal("TEST-key");
    render(
      <CheckoutModal
        {...baseProps}
        isOpen={false}
        onClose={vi.fn()}
        preferenceId="p"
      />,
    );
    expect(screen.queryByText("Complete Payment")).toBeNull();
  });

  it("initializes MercadoPago and renders the wallet for a preference", async () => {
    const CheckoutModal = await loadCheckoutModal("TEST-key");
    render(
      <CheckoutModal
        {...baseProps}
        isOpen
        onClose={vi.fn()}
        preferenceId="pref-123"
      />,
    );

    expect(mp.initMercadoPago).toHaveBeenCalledWith("TEST-key", {
      locale: "es-CO",
    });
    expect(screen.getByText("Starter")).toBeTruthy();
    expect(screen.getByText("$9.99")).toBeTruthy();
    expect(screen.getByTestId("mp-wallet")).toBeTruthy();
    expect(mp.walletProps[0]).toMatchObject({
      initialization: { preferenceId: "pref-123" },
    });
  });

  it("shows a preparing state until the preference exists", async () => {
    const CheckoutModal = await loadCheckoutModal("TEST-key");
    render(
      <CheckoutModal
        {...baseProps}
        isOpen
        onClose={vi.fn()}
        preferenceId={null}
      />,
    );

    expect(
      screen.getByText("Preparing secure payment environment..."),
    ).toBeTruthy();
    expect(screen.queryByTestId("mp-wallet")).toBeNull();
  });

  it("explains a missing public key instead of rendering the wallet", async () => {
    const CheckoutModal = await loadCheckoutModal(undefined);
    render(
      <CheckoutModal
        {...baseProps}
        isOpen
        onClose={vi.fn()}
        preferenceId="pref-123"
        title="Pay"
      />,
    );

    expect(mp.initMercadoPago).not.toHaveBeenCalled();
    expect(screen.getByText("Pay")).toBeTruthy();
    expect(
      screen.getByText(
        "Payment configuration missing. Please contact support.",
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId("mp-wallet")).toBeNull();
  });

  it("closes from the close button", async () => {
    const CheckoutModal = await loadCheckoutModal("TEST-key");
    const onClose = vi.fn();
    render(
      <CheckoutModal
        {...baseProps}
        isOpen
        onClose={onClose}
        preferenceId={null}
      />,
    );

    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const CheckoutModal = await loadCheckoutModal("TEST-key");
    const onClose = vi.fn();
    render(
      <CheckoutModal
        {...baseProps}
        isOpen
        onClose={onClose}
        preferenceId={null}
      />,
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
