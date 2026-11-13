import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({ default: { patch: vi.fn() } }));

import { toast } from "sonner";
import api from "@/lib/api";
import { TweetActionCard } from "@/components/chat/tweet-action-card";

const patch = vi.mocked(api.patch);

function renderCard(content = "Shipping day! 🚀") {
  render(
    <TweetActionCard draftId="draft-1" content={content} topic="AI news" />,
  );
}

function editTo(text: string) {
  fireEvent.click(screen.getByText("Edit"));
  fireEvent.change(screen.getByLabelText("Edit tweet content"), {
    target: { value: text },
  });
}

describe("TweetActionCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the draft, topic and character count", () => {
    renderCard("Hello X");

    expect(screen.getByText("Hello X")).toBeTruthy();
    expect(screen.getByText("Topic: AI news")).toBeTruthy();
    expect(screen.getByText("7/280 characters")).toBeTruthy();
  });

  it("saves an edited tweet", async () => {
    patch.mockResolvedValue({});
    renderCard();
    editTo("Updated tweet");

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(patch).toHaveBeenCalledWith("/social/tweets/drafts/draft-1", {
      content: "Updated tweet",
    });
    expect(toast.success).toHaveBeenCalledWith("Tweet updated");
    expect(screen.queryByLabelText("Edit tweet content")).toBeNull();
  });

  it("blocks tweets over 280 characters", () => {
    renderCard();
    editTo("x".repeat(281));

    expect(screen.getByText("281/280")).toBeTruthy();
    const save = screen.getByText("Save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(save);
    expect(patch).not.toHaveBeenCalled();
  });

  it("allows exactly 280 characters", async () => {
    patch.mockResolvedValue({});
    renderCard();
    editTo("x".repeat(280));

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(patch).toHaveBeenCalled();
  });

  it("keeps the editor open when saving fails", async () => {
    patch.mockRejectedValue(new Error("500"));
    renderCard();
    editTo("Will fail");

    await act(async () => {
      fireEvent.click(screen.getByText("Save"));
    });

    expect(toast.error).toHaveBeenCalledWith("Failed to update tweet");
    expect(screen.getByLabelText("Edit tweet content")).toBeTruthy();
    expect((screen.getByText("Save") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("discards edits on cancel", () => {
    renderCard("Original");
    editTo("Changed");

    fireEvent.click(screen.getByText("Cancel"));
    fireEvent.click(screen.getByText("Edit"));

    expect(
      (screen.getByLabelText("Edit tweet content") as HTMLTextAreaElement)
        .value,
    ).toBe("Original");
  });
});
