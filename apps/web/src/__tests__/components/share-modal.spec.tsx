import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { ShareModal } from "@/components/share-modal";

const SHARE_URL = "https://app.creatorhubplatform.com/share/asset-1";

function renderModal(
  overrides: Partial<Parameters<typeof ShareModal>[0]> = {},
) {
  const props = {
    assetId: "asset-1",
    assetPrompt: "a neon city",
    assetType: "IMAGE" as const,
    isPublic: true,
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ShareModal {...props} />);
  return props;
}

describe("ShareModal", () => {
  const writeText = vi.fn();
  const openMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.stubGlobal("open", openMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete (navigator as { share?: unknown }).share;
  });

  it("shows the public share link for the asset", () => {
    renderModal();
    expect(
      (screen.getByLabelText("Share Link") as HTMLInputElement).value,
    ).toBe(SHARE_URL);
  });

  it("copies the link and shows confirmation briefly", async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    renderModal();

    await act(async () => {
      fireEvent.click(screen.getByText("Copy"));
    });

    expect(writeText).toHaveBeenCalledWith(SHARE_URL);
    expect(toast.success).toHaveBeenCalledWith("Link copied to clipboard!");
    expect(screen.getByText("Copied!")).toBeTruthy();

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("reports clipboard failures", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    renderModal();

    await act(async () => {
      fireEvent.click(screen.getByText("Copy"));
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to copy link");
  });

  it.each([
    ["Facebook", "https://www.facebook.com/sharer/sharer.php?u="],
    ["X (Twitter)", "https://twitter.com/intent/tweet?text="],
    ["LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url="],
    ["WhatsApp", "https://wa.me/?text="],
    ["Telegram", "https://t.me/share/url?url="],
    ["Reddit", "https://reddit.com/submit?url="],
  ])("opens the %s share dialog with the encoded link", (name, prefix) => {
    renderModal();

    fireEvent.click(screen.getByText(name));

    const [url, target] = openMock.mock.calls[0]!;
    expect(url.startsWith(prefix)).toBe(true);
    expect(url).toContain(encodeURIComponent(SHARE_URL));
    expect(target).toBe("_blank");
  });

  describe("when the asset is private", () => {
    it("warns, disables sharing and offers to make it public", () => {
      const onTogglePublic = vi.fn();
      renderModal({ isPublic: false, onTogglePublic });

      expect(screen.getByText("This asset is private")).toBeTruthy();
      expect(
        (screen.getByText("Facebook").closest("button") as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (screen.getByText("Copy").closest("button") as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        screen.getByText(
          "Only you can see this asset until you make it public",
        ),
      ).toBeTruthy();

      fireEvent.click(screen.getByText("Make public now"));
      expect(onTogglePublic).toHaveBeenCalled();
    });

    it("never shares or copies the link", () => {
      renderModal({ isPublic: false });

      fireEvent.click(screen.getByText("Copy"));
      fireEvent.click(screen.getByText("Facebook"));

      expect(writeText).not.toHaveBeenCalled();
      expect(openMock).not.toHaveBeenCalled();
    });

    it("hides the make-public shortcut without a handler", () => {
      renderModal({ isPublic: false });
      expect(screen.queryByText("Make public now")).toBeNull();
    });
  });

  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    renderModal({ assetType: "VIDEO" });

    await act(async () => {
      fireEvent.click(screen.getByText("Share via Device"));
    });

    expect(share).toHaveBeenCalledWith({
      title: "Created with Creator Hub",
      text: 'Check out this video on Creator Hub: "a neon city"',
      url: SHARE_URL,
    });
  });

  it("closes from the backdrop", () => {
    const { onClose } = renderModal();
    const backdrop = document.querySelector(".bg-black\\/80") as HTMLElement;

    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });
});
