import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn() },
}));

import api from "@/lib/api";
import {
  assetLink,
  fetchAssetEngagement,
  normalizeAssetEngagement,
} from "../asset-stats";

const apiMock = vi.mocked(api);

beforeEach(() => vi.clearAllMocks());

describe("normalizeAssetEngagement", () => {
  it("keeps a well-formed answer", () => {
    const body = {
      totals: { likes: 12, views: 340, assets: 9, publicAssets: 3 },
      top: [
        {
          id: "a1",
          type: "VIDEO",
          title: "Launch teaser",
          previewUrl: "https://signed/thumb.jpg",
          likeCount: 5,
          viewCount: 40,
          isPublic: true,
          createdAt: "2026-11-10T12:00:00.000Z",
        },
      ],
    };
    expect(normalizeAssetEngagement(body)).toEqual(body);
  });

  it("turns anything else into zeros and no assets", () => {
    const empty = {
      totals: { likes: 0, views: 0, assets: 0, publicAssets: 0 },
      top: [],
    };
    for (const body of [undefined, null, {}, "x", { totals: "?", top: {} }]) {
      expect(normalizeAssetEngagement(body)).toEqual(empty);
    }
  });

  it("cleans counts and fields, and drops assets without an id", () => {
    const result = normalizeAssetEngagement({
      totals: { likes: -4, views: 10.7, assets: "9" },
      top: [
        { id: "a1", likeCount: "3", viewCount: -1, previewUrl: "" },
        { title: "no id" },
        null,
      ],
    });
    expect(result.totals).toEqual({
      likes: 0,
      views: 10,
      assets: 0,
      publicAssets: 0,
    });
    expect(result.top).toEqual([
      {
        id: "a1",
        type: "IMAGE",
        title: "",
        previewUrl: null,
        likeCount: 0,
        viewCount: 0,
        isPublic: false,
        createdAt: "",
      },
    ]);
  });
});

describe("fetchAssetEngagement", () => {
  it("asks for the top four by default and normalizes the answer", async () => {
    apiMock.get.mockResolvedValue({});

    expect((await fetchAssetEngagement()).top).toEqual([]);
    expect(apiMock.get).toHaveBeenCalledWith("/user/assets/engagement", {
      params: { limit: "4" },
    });
  });
});

describe("assetLink", () => {
  it("opens a shared asset's public page in a new tab", () => {
    expect(assetLink({ id: "a 1", isPublic: true })).toEqual({
      href: "/share/a%201",
      newTab: true,
    });
  });

  it("opens the Assets page for a private one, in the same tab", () => {
    expect(assetLink({ id: "a1", isPublic: false })).toEqual({
      href: "/assets",
      newTab: false,
    });
  });
});
