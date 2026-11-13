import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

import api from "@/lib/api";
import { UpgradeModal } from "@/components/modals/upgrade-modal";
import { renderWithProviders } from "../test-utils";
import { routerMock } from "../mocks/next-navigation";

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

const PLANS = [
  {
    id: "p-starter",
    slug: "STARTER",
    name: "Starter",
    usdAmount: 10,
    creditsGiven: 1000,
  },
  { id: "p-pro", slug: "PRO", name: "Pro", usdAmount: 25, creditsGiven: 3000 },
  {
    id: "p-payg",
    slug: "PAY_AS_YOU_GO",
    name: "Pay as you go",
    usdAmount: 1,
    creditsGiven: 100,
  },
];

describe("UpgradeModal", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(PLANS);
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "http://localhost/" },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("does not fetch plans or render while closed", () => {
    renderWithProviders(<UpgradeModal isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByText("No credits remaining")).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("lists credit packs (excluding pay-as-you-go) with per-credit pricing", async () => {
    renderWithProviders(<UpgradeModal isOpen onClose={vi.fn()} />);

    expect(await screen.findByText("Starter")).toBeTruthy();
    expect(get).toHaveBeenCalledWith("/credits/plans");
    expect(screen.getByText("Pro")).toBeTruthy();
    expect(screen.queryByText("Pay as you go")).toBeNull();
    expect(screen.getByText("$10.00")).toBeTruthy();
    expect(screen.getByText((1000).toLocaleString() + " credits")).toBeTruthy();
    expect(screen.getByText("1.0¢/credit")).toBeTruthy();
    expect(screen.getByText("0.8¢/credit")).toBeTruthy();
  });

  it("marks the Starter pack as best value", async () => {
    renderWithProviders(<UpgradeModal isOpen onClose={vi.fn()} />);

    const starter = (await screen.findByText("Starter")).closest("button")!;
    const pro = screen.getByText("Pro").closest("button")!;
    expect(starter.textContent).toContain("BEST VALUE");
    expect(pro.textContent).not.toContain("BEST VALUE");
  });

  it("starts checkout for the chosen pack and shows the embedded payment state", async () => {
    post.mockResolvedValue({ preferenceId: "pref-1", gatewayTxId: "tx-1" });
    renderWithProviders(<UpgradeModal isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(await screen.findByText("Pro"));
    });

    expect(post).toHaveBeenCalledWith("/credits/checkout", { planId: "p-pro" });
    expect(screen.getByText("Complete your purchase")).toBeTruthy();
    expect(screen.getByText("Purchasing Pro plan for $25.00")).toBeTruthy();
    expect(screen.getByText("Redirecting to payment...")).toBeTruthy();
    expect(window.location.href).toBe("http://localhost/");
  });

  it("redirects to the gateway when no embedded preference is returned", async () => {
    post.mockResolvedValue({ redirectUrl: "https://pay.example/checkout/1" });
    renderWithProviders(<UpgradeModal isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(await screen.findByText("Starter"));
    });

    expect(window.location.href).toBe("https://pay.example/checkout/1");
  });

  it("closes the purchase dialog when checkout fails", async () => {
    post.mockRejectedValue(new Error("gateway down"));
    renderWithProviders(<UpgradeModal isOpen onClose={vi.fn()} />);

    await act(async () => {
      fireEvent.click(await screen.findByText("Starter"));
    });

    expect(screen.queryByText("Complete your purchase")).toBeNull();
  });

  it("links to subscriptions and can be dismissed", async () => {
    const onClose = vi.fn();
    renderWithProviders(<UpgradeModal isOpen onClose={onClose} />);
    await screen.findByText("Starter");

    fireEvent.click(screen.getByText("Or Subscribe for Unlimited"));
    fireEvent.click(screen.getByText("Maybe later"));

    expect(routerMock.push).toHaveBeenCalledWith("/pricing");
    expect(onClose).toHaveBeenCalled();
  });
});
