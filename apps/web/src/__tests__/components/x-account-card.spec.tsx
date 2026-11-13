import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { toast } from "sonner";
import api from "@/lib/api";
import { XAccountCard } from "@/components/settings/x-account-card";

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const del = vi.mocked(api.delete);

function xAccount(status = "ACTIVE") {
  return {
    id: "acc-1",
    provider: "X_TWITTER",
    providerUsername: "creator",
    displayName: "The Creator",
    avatarUrl: null,
    status,
    scopes: [],
    lastUsedAt: null,
    createdAt: "2026-01-01",
  };
}

async function renderCard() {
  render(<XAccountCard />);
  await screen.findByText("Integrations");
}

describe("XAccountCard", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "http://localhost/settings" },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("shows a spinner while loading", () => {
    get.mockReturnValue(new Promise(() => {}));
    render(<XAccountCard />);
    expect(screen.queryByText("Integrations")).toBeNull();
  });

  it("shows 'Not connected' when there is no X account", async () => {
    get.mockResolvedValue({ data: [{ ...xAccount(), provider: "LINKEDIN" }] });
    await renderCard();

    expect(get).toHaveBeenCalledWith("/social/accounts");
    expect(screen.getByText("Not connected")).toBeTruthy();
    expect(screen.getByText("Connect")).toBeTruthy();
  });

  it("still renders when loading accounts fails", async () => {
    get.mockRejectedValue(new Error("401"));
    await renderCard();
    expect(screen.getByText("Not connected")).toBeTruthy();
  });

  it("sends the user to X's authorization page to connect", async () => {
    get.mockResolvedValue({ data: [] });
    post.mockResolvedValue({
      data: { authorizationUrl: "https://x.com/i/oauth2/authorize?x=1" },
    });
    await renderCard();

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(post).toHaveBeenCalledWith("/social/x/connect");
    expect(window.location.href).toBe("https://x.com/i/oauth2/authorize?x=1");
  });

  it("re-enables the connect button when connecting fails", async () => {
    get.mockResolvedValue({ data: [] });
    post.mockRejectedValue(new Error("500"));
    await renderCard();

    await act(async () => {
      fireEvent.click(screen.getByText("Connect"));
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to initiate X connection");
    expect((screen.getByText("Connect") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("shows the connected account", async () => {
    get.mockResolvedValue({ data: [xAccount()] });
    await renderCard();

    expect(screen.getByText("@creator • The Creator")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.queryByText("Reconnect")).toBeNull();
  });

  it("disconnects the account", async () => {
    get.mockResolvedValue({ data: [xAccount()] });
    del.mockResolvedValue({});
    await renderCard();

    await act(async () => {
      fireEvent.click(screen.getByText("Disconnect"));
    });

    expect(del).toHaveBeenCalledWith("/social/accounts/acc-1");
    expect(toast.success).toHaveBeenCalledWith("X account disconnected");
    expect(screen.getByText("Not connected")).toBeTruthy();
  });

  it("keeps the account when disconnecting fails", async () => {
    get.mockResolvedValue({ data: [xAccount()] });
    del.mockRejectedValue(new Error("500"));
    await renderCard();

    await act(async () => {
      fireEvent.click(screen.getByText("Disconnect"));
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to disconnect account");
    expect(screen.getByText("@creator • The Creator")).toBeTruthy();
  });

  it("offers to reconnect an expired account and refreshes its tokens", async () => {
    get
      .mockResolvedValueOnce({ data: [xAccount("EXPIRED")] })
      .mockResolvedValueOnce({ data: [xAccount("ACTIVE")] });
    post.mockResolvedValue({});
    await renderCard();
    expect(screen.getByText("EXPIRED")).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText("Reconnect"));
    });

    expect(post).toHaveBeenCalledWith("/social/accounts/acc-1/refresh");
    expect(toast.success).toHaveBeenCalledWith("Tokens refreshed successfully");
    expect(screen.getByText("ACTIVE")).toBeTruthy();
  });

  it("reports a failed token refresh", async () => {
    get.mockResolvedValue({ data: [xAccount("EXPIRED")] });
    post.mockRejectedValue(new Error("invalid_grant"));
    await renderCard();

    await act(async () => {
      fireEvent.click(screen.getByText("Reconnect"));
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to refresh tokens");
  });
});
