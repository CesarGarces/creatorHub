import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate, type ValidationError } from "class-validator";
import {
  AnalyzeVideoDto,
  EstimateAnalysisQueryDto,
  ListAnalysesQueryDto,
} from "../dto/analyze-video.dto";
import { MAX_FRAMES, MAX_VIDEO_BYTES } from "../video-clipper.constants";

const FRAME = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

/** "property" or "parent.child" paths of every failing field. */
function paths(errors: ValidationError[], parent = ""): string[] {
  return errors.flatMap((e) => {
    const path = parent ? `${parent}.${e.property}` : e.property;
    return e.children?.length ? paths(e.children, path) : [path];
  });
}

async function errorsFor<T extends object>(cls: new () => T, body: object) {
  return paths(
    await validate(plainToInstance(cls, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
}

const valid = {
  model: "google/gemini-2.5-flash",
  video: {
    fileName: "vlog.mp4",
    durationSec: 125.4,
    width: 1920,
    height: 1080,
    sizeBytes: 50_000_000,
    mimeType: "video/mp4",
  },
  frames: [
    { timestamp: 5, image: FRAME },
    { timestamp: 60.2, image: FRAME },
  ],
  platform: "tiktok",
  language: "es",
  context: "Cooking pasta",
};

describe("AnalyzeVideoDto", () => {
  it("accepts a complete request", async () => {
    expect(await errorsFor(AnalyzeVideoDto, valid)).toEqual([]);
  });

  it("accepts the minimal request (platform, language and notes are optional)", async () => {
    const { platform: _p, language: _l, context: _c, ...minimal } = valid;
    expect(await errorsFor(AnalyzeVideoDto, minimal)).toEqual([]);
  });

  it("rejects files over 250 MB with a clear message", async () => {
    const dto = plainToInstance(AnalyzeVideoDto, {
      ...valid,
      video: { ...valid.video, sizeBytes: MAX_VIDEO_BYTES + 1 },
    });
    const [error] = await validate(dto);
    expect(error?.children?.[0]?.constraints).toEqual({
      max: "Videos larger than 250 MB are not supported yet",
    });
  });

  it("validates every keyframe: data URL format, size and timestamp", async () => {
    expect(
      await errorsFor(AnalyzeVideoDto, {
        ...valid,
        frames: [
          { timestamp: 1, image: "https://example.com/frame.jpg" },
          { timestamp: -1, image: FRAME },
          {
            timestamp: 2,
            image: `data:image/jpeg;base64,${"A".repeat(600_001)}`,
          },
          { timestamp: 3, image: "data:image/gif;base64,AAAA" },
        ],
      }),
    ).toEqual([
      "frames.0.image",
      "frames.1.timestamp",
      "frames.2.image",
      "frames.3.image",
    ]);
  });

  it("needs 1 to 32 keyframes", async () => {
    expect(await errorsFor(AnalyzeVideoDto, { ...valid, frames: [] })).toEqual([
      "frames",
    ]);
    expect(
      await errorsFor(AnalyzeVideoDto, {
        ...valid,
        frames: Array.from({ length: MAX_FRAMES + 1 }, (_, i) => ({
          timestamp: i,
          image: FRAME,
        })),
      }),
    ).toEqual(["frames"]);
  });

  it("rejects unknown platforms/languages, bad durations and extra fields", async () => {
    const errors = await errorsFor(AnalyzeVideoDto, {
      ...valid,
      platform: "myspace",
      language: "fr",
      context: "x".repeat(501),
      video: { ...valid.video, durationSec: 0, extra: true },
      videoFile: "base64 of the whole video",
    });
    expect(errors.sort()).toEqual(
      [
        "context",
        "language",
        "platform",
        "video.durationSec",
        "video.extra",
        // The video itself is never accepted by the API.
        "videoFile",
      ].sort(),
    );
  });
});

describe("query DTOs", () => {
  it("coerces and bounds the estimate query", async () => {
    expect(
      await errorsFor(EstimateAnalysisQueryDto, { model: "m", frames: "24" }),
    ).toEqual([]);
    expect(
      await errorsFor(EstimateAnalysisQueryDto, { model: "", frames: "33" }),
    ).toEqual(["model", "frames"]);
  });

  it("bounds pagination", async () => {
    expect(await errorsFor(ListAnalysesQueryDto, {})).toEqual([]);
    expect(
      await errorsFor(ListAnalysesQueryDto, { page: "2", limit: "10" }),
    ).toEqual([]);
    expect(
      await errorsFor(ListAnalysesQueryDto, { page: "0", limit: "500" }),
    ).toEqual(["page", "limit"]);
  });
});
