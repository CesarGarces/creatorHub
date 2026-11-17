import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import api from "@/lib/api";
import { useVideoClipperStore } from "@/store/video-clipper.store";
import type { VideoAnalysisResult } from "@/lib/video-clipper/types";

const apiMock = vi.mocked(api);

const RESULT: VideoAnalysisResult = {
  summary: "Cooking vlog",
  contentType: "vlog",
  highlights: [
    {
      id: "h1",
      start: 10,
      end: 35,
      title: "Intro",
      hook: "Watch",
      reason: "Open",
      score: 70,
      tags: [],
    },
    {
      id: "h2",
      start: 60,
      end: 90,
      title: "Sauce",
      hook: "Secret",
      reason: "Payoff",
      score: 92,
      tags: [],
    },
  ],
  hooks: [{ text: "Stop boiling pasta like this", style: "bold-claim" }],
  titles: [{ text: "30 days of pasta", platform: "youtube" }],
  hashtags: ["#pasta"],
  platform: "tiktok",
  language: "en",
  video: { fileName: "vlog.mp4", durationSec: 120, width: 1920, height: 1080 },
  frames: 16,
  model: { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
};

const VIDEO = {
  fileName: "vlog.mp4",
  sizeBytes: 80_000_000,
  mimeType: "video/mp4",
  durationSec: 120,
  width: 0,
  height: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  useVideoClipperStore.setState(useVideoClipperStore.getInitialState(), true);
  apiMock.get.mockResolvedValue({ data: [] });
});

describe("video clipper store", () => {
  it("sends the keyframes (never the video) and loads the analysis", async () => {
    apiMock.post.mockResolvedValue({
      data: { analysisId: "va1", result: RESULT, creditsCharged: 8 },
    });

    const out = await useVideoClipperStore.getState().analyze({
      model: "google/gemini-2.5-flash",
      video: VIDEO,
      frames: [
        { timestamp: 5, dataUrl: "data:image/jpeg;base64,AAA" },
        { timestamp: 20, dataUrl: "data:image/jpeg;base64,BBB" },
      ],
      platform: "tiktok",
      language: "es",
      context: "  Pasta  ",
    });

    expect(apiMock.post).toHaveBeenCalledWith(
      "/tools/video-clipper/analyses",
      {
        model: "google/gemini-2.5-flash",
        platform: "tiktok",
        language: "es",
        context: "Pasta",
        video: {
          fileName: "vlog.mp4",
          durationSec: 120,
          width: undefined,
          height: undefined,
          sizeBytes: 80_000_000,
          mimeType: "video/mp4",
        },
        frames: [
          { timestamp: 5, image: "data:image/jpeg;base64,AAA" },
          { timestamp: 20, image: "data:image/jpeg;base64,BBB" },
        ],
      },
      { signal: undefined },
    );
    expect(out).toEqual({ id: "va1", result: RESULT, creditsCharged: 8 });
    const state = useVideoClipperStore.getState();
    expect(state.analysis?.id).toBe("va1");
    expect(state.ranges).toEqual({
      h1: { start: 10, end: 35 },
      h2: { start: 60, end: 90 },
    });
    expect(state.isAnalyzing).toBe(false);
    // History refreshed with the new analysis.
    expect(apiMock.get).toHaveBeenCalledWith("/tools/video-clipper/analyses", {
      params: { limit: "10" },
    });
  });

  it.each([
    [
      "This model can't analyze video frames. Choose a vision model.",
      "This model can't analyze video frames. Choose a vision model.",
    ],
    [
      "video.Videos larger than 250 MB are not supported yet",
      "Videos larger than 250 MB are not supported yet.",
    ],
    [
      "Insufficient credits. This analysis requires 8 credits.",
      expect.stringMatching(/credits/i),
    ],
    ["", "The analysis failed. Please try again."],
  ])("shows a localized error for %j", async (message, shown) => {
    apiMock.post.mockRejectedValue(new Error(message));
    const out = await useVideoClipperStore.getState().analyze({
      model: "m",
      video: VIDEO,
      frames: [],
      platform: "youtube-shorts",
      language: "en",
    });
    expect(out).toBeNull();
    expect(useVideoClipperStore.getState().error).toEqual(shown);
  });

  it("shows no error when the user cancelled", async () => {
    const controller = new AbortController();
    apiMock.post.mockImplementation(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });
    await useVideoClipperStore.getState().analyze({
      model: "m",
      video: VIDEO,
      frames: [],
      platform: "youtube-shorts",
      language: "en",
      signal: controller.signal,
    });
    expect(useVideoClipperStore.getState()).toMatchObject({
      error: null,
      isAnalyzing: false,
    });
  });

  it("fetches the estimate and ignores answers for a model no longer selected", async () => {
    const store = useVideoClipperStore.getState();
    store.setModel("a");
    apiMock.get.mockResolvedValueOnce({ data: { total: 4 } });
    await store.fetchEstimate("a", 14);
    expect(apiMock.get).toHaveBeenCalledWith("/tools/video-clipper/estimate", {
      params: { model: "a", frames: "14" },
    });
    expect(useVideoClipperStore.getState().estimate).toEqual({ total: 4 });

    apiMock.get.mockImplementationOnce(async () => {
      useVideoClipperStore.getState().setModel("b"); // changed meanwhile
      return { data: { total: 99 } };
    });
    await store.fetchEstimate("a", 14);
    expect(useVideoClipperStore.getState().estimate).toEqual({ total: 4 });
  });

  it("trims and resets clip ranges", () => {
    useVideoClipperStore.setState({
      analysis: { id: "va1", result: RESULT },
      ranges: { h1: { start: 10, end: 35 } },
    });
    const store = useVideoClipperStore.getState();
    store.setRange("h1", { start: 12, end: 30 });
    expect(useVideoClipperStore.getState().ranges.h1).toEqual({
      start: 12,
      end: 30,
    });
    store.resetRange("h1");
    expect(useVideoClipperStore.getState().ranges.h1).toEqual({
      start: 10,
      end: 35,
    });
  });

  it("opens and deletes analyses from the history", async () => {
    apiMock.get.mockResolvedValueOnce({ data: { id: "va1", result: RESULT } });
    await useVideoClipperStore.getState().openAnalysis("va1");
    expect(useVideoClipperStore.getState()).toMatchObject({
      analysis: { id: "va1" },
      platform: "tiktok",
      ranges: { h2: { start: 60, end: 90 } },
    });

    useVideoClipperStore.setState({
      history: [{ id: "va1" }, { id: "va2" }] as never,
    });
    apiMock.delete.mockResolvedValue(undefined);
    await expect(
      useVideoClipperStore.getState().deleteAnalysis("va1"),
    ).resolves.toBe(true);
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/tools/video-clipper/analyses/va1",
    );
    expect(useVideoClipperStore.getState()).toMatchObject({
      analysis: null,
      ranges: {},
      history: [{ id: "va2" }],
    });
  });
});
