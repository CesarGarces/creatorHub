import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { AssetLikeButton } from "@/components/asset-like-button";
import { useAssetLikesStore } from "@/store/asset-likes.store";

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("AssetLikeButton", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAssetLikesStore.setState({ likesMap: {} });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the server like state after loading", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ liked: true, likeCount: 12 }));

    render(<AssetLikeButton assetId="a1" initialLikeCount={3} />);

    // Initial count from props until the status arrives.
    expect(screen.getByRole("button").textContent).toBe("3");
    await waitFor(() =>
      expect(screen.getByLabelText("Unlike this asset").textContent).toBe("12"),
    );
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/sharing\/a1\/liked$/);
  });

  it("likes optimistically and sends the request", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/liked")
        ? jsonResponse({ liked: false, likeCount: 5 })
        : jsonResponse({ liked: true, likeCount: 6 }),
    );

    render(<AssetLikeButton assetId="a1" initialLikeCount={5} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Like this asset"));
    });

    expect(screen.getByLabelText("Unlike this asset").textContent).toBe("6");
    const [likeUrl, likeInit] = fetchMock.mock.calls[1]!;
    expect(likeUrl).toMatch(/\/sharing\/a1\/like$/);
    expect(likeInit).toMatchObject({ method: "POST" });
  });

  it("refuses to like a private asset", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ liked: false, likeCount: 0 }));

    render(
      <AssetLikeButton assetId="a1" initialLikeCount={0} isPublic={false} />,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button"));

    expect(toast.error).toHaveBeenCalledWith(
      "Make the asset public first to like it",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1); // no like request
  });

  it("does not trigger parent click handlers", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ liked: false, likeCount: 0 }));
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <AssetLikeButton assetId="a1" initialLikeCount={0} />
      </div>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("can hide the count", () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    render(
      <AssetLikeButton assetId="a1" initialLikeCount={9} showCount={false} />,
    );
    expect(screen.getByRole("button").textContent).toBe("");
  });
});
