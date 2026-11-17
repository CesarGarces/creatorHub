import { describe, expect, it, vi } from "vitest";
import { HttpException } from "@nestjs/common";
import { VideoClipperController } from "../video-clipper.controller";
import {
  AnalysisAbortedError,
  type AnalyzeVideoInput,
} from "../video-clipper.service";
import { MAX_VIDEO_BYTES } from "../video-clipper.constants";

function fakeResponse() {
  let onClose: (() => void) | undefined;
  const res = {
    writableFinished: false,
    on: (_event: "close", listener: () => void) => (onClose = listener),
  };
  return { res, close: () => onClose?.() };
}

const body = {
  model: "google/gemini-2.5-flash",
  video: { fileName: "a.mp4", durationSec: 30 },
  frames: [{ timestamp: 1, image: "data:image/jpeg;base64,AAAA" }],
};

describe("VideoClipperController", () => {
  it("exposes the browser limits and the 10 GB roadmap", () => {
    const { data } = new VideoClipperController({} as never).limits();
    expect(data.maxVideoBytes).toBe(MAX_VIDEO_BYTES);
    expect(data.maxFrames).toBe(32);
    expect(data.roadmap.heavyFilesMaxBytes).toBe(10 * 1024 ** 3);
    expect(Object.keys(data.platforms)).toEqual([
      "youtube-shorts",
      "tiktok",
      "instagram-reels",
      "youtube",
    ]);
  });

  it("wraps the estimate", async () => {
    const clipper = { estimate: vi.fn(async () => ({ total: 8 })) };
    const controller = new VideoClipperController(clipper as never);
    await expect(
      controller.estimate("u1", { model: "m", frames: 20 }),
    ).resolves.toEqual({ success: true, data: { total: 8 } });
    expect(clipper.estimate).toHaveBeenCalledWith("u1", "m", 20);
  });

  it("analyzes with default platform and language", async () => {
    const clipper = {
      analyze: vi.fn(async () => ({
        analysisId: "va1",
        result: {},
        creditsCharged: 4,
      })),
    };
    const controller = new VideoClipperController(clipper as never);
    const { res } = fakeResponse();

    await expect(controller.analyze("u1", body as never, res)).resolves.toEqual(
      {
        success: true,
        data: { analysisId: "va1", result: {}, creditsCharged: 4 },
      },
    );
    const input = clipper.analyze.mock
      .calls[0]![0] as unknown as AnalyzeVideoInput;
    expect(input).toMatchObject({
      userId: "u1",
      modelId: "google/gemini-2.5-flash",
      platform: "youtube-shorts",
      language: "en",
    });
    expect(input.signal?.aborted).toBe(false);
  });

  it("aborts the analysis when the client disconnects and answers 499", async () => {
    let signal: AbortSignal | undefined;
    const { res, close } = fakeResponse();
    const clipper = {
      analyze: vi.fn(async (input: AnalyzeVideoInput) => {
        signal = input.signal;
        close(); // user closed the tab while the model was working
        throw new AnalysisAbortedError();
      }),
    };
    const controller = new VideoClipperController(clipper as never);

    const error = await controller
      .analyze(
        "u1",
        { ...body, platform: "tiktok", language: "pt" } as never,
        res,
      )
      .catch((e: unknown) => e);
    expect(signal?.aborted).toBe(true);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(499);
  });

  it("does not abort once the response was sent", () => {
    const { res, close } = fakeResponse();
    let signal: AbortSignal | undefined;
    const controller = new VideoClipperController({
      analyze: vi.fn(async (input: AnalyzeVideoInput) => {
        signal = input.signal;
        return {};
      }),
    } as never);
    void controller.analyze("u1", body as never, res);
    res.writableFinished = true;
    close();
    expect(signal?.aborted).toBe(false);
  });

  it("lists, gets and deletes analyses", async () => {
    const clipper = {
      listAnalyses: vi.fn(async () => ({ data: [], meta: { page: 1 } })),
      getAnalysis: vi.fn(async () => ({ id: "va1" })),
      deleteAnalysis: vi.fn(async () => undefined),
    };
    const controller = new VideoClipperController(clipper as never);

    await expect(controller.list("u1", {})).resolves.toEqual({
      success: true,
      data: [],
      meta: { page: 1 },
    });
    expect(clipper.listAnalyses).toHaveBeenCalledWith("u1", 1, 20);
    await expect(controller.get("u1", "va1")).resolves.toEqual({
      success: true,
      data: { id: "va1" },
    });
    await expect(controller.remove("u1", "va1")).resolves.toEqual({
      success: true,
    });
    expect(clipper.deleteAnalysis).toHaveBeenCalledWith("u1", "va1");
  });
});
