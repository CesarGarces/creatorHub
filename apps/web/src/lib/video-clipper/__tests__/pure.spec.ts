import { describe, expect, it } from "vitest";
import {
  keyframeCount,
  keyframeSize,
  planKeyframeTimestamps,
} from "../keyframes";
import { checkVideoFile } from "../video-file";
import {
  formatBytes,
  formatClipTime,
  formatSeconds,
  formatTimestamp,
} from "../format";
import {
  edgeBounds,
  moveRange,
  nudgeRange,
  rangeLength,
  sameRange,
  setRangeEdge,
} from "../ranges";
import {
  clipFileName,
  exportGeometry,
  pickRecorderFormat,
  videoBitrate,
} from "../clip-export";
import { MAX_KEYFRAMES, MAX_VIDEO_BYTES, MIN_KEYFRAMES } from "../constants";

const MB = 1024 * 1024;

describe("keyframe sampling plan", () => {
  it.each([
    [0, 0],
    [-5, 0],
    [Number.NaN, 0],
    [Infinity, 0],
    [1, 1],
    [3.2, 4],
    [15, 9],
    [60, 14],
    [180, 20],
    [600, 28],
    [3600, 32],
    [6 * 3600, 32],
  ])("a %s s video gets %s keyframes", (duration, count) => {
    expect(keyframeCount(duration)).toBe(count);
  });

  it("grows with the duration and stays within 6–32 from 6 s on", () => {
    let previous = 0;
    for (let d = 6; d <= 7200; d += 7) {
      const n = keyframeCount(d);
      expect(n).toBeGreaterThanOrEqual(previous);
      expect(n).toBeGreaterThanOrEqual(MIN_KEYFRAMES);
      expect(n).toBeLessThanOrEqual(MAX_KEYFRAMES);
      previous = n;
    }
  });

  it("spreads timestamps evenly at the centre of each slice", () => {
    expect(planKeyframeTimestamps(60)).toHaveLength(14);
    const ts = planKeyframeTimestamps(100);
    expect(ts[0]).toBeGreaterThan(0);
    expect(ts.at(-1)).toBeLessThan(100);
    const gaps = ts.slice(1).map((t, i) => t - ts[i]!);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(0.2);
    expect(planKeyframeTimestamps(0)).toEqual([]);
  });

  it("scales keyframes down to a 512 px longest edge, never up", () => {
    expect(keyframeSize(1920, 1080)).toEqual({ width: 512, height: 288 });
    expect(keyframeSize(1080, 1920)).toEqual({ width: 288, height: 512 });
    expect(keyframeSize(320, 240)).toEqual({ width: 320, height: 240 });
    expect(keyframeSize(0, 0)).toEqual({ width: 512, height: 512 });
  });
});

describe("checkVideoFile", () => {
  const file = (name: string, type: string, size: number) => ({
    name,
    type,
    size,
  });

  it("accepts videos up to 250 MB, by MIME type or extension", () => {
    expect(checkVideoFile(file("a.mp4", "video/mp4", 10 * MB))).toEqual({
      ok: true,
    });
    expect(checkVideoFile(file("a.MOV", "", MAX_VIDEO_BYTES))).toEqual({
      ok: true,
    });
  });

  it("rejects non-videos and empty files", () => {
    expect(checkVideoFile(file("a.pdf", "application/pdf", 10))).toMatchObject({
      ok: false,
      reason: "type",
    });
    expect(checkVideoFile(file("notes", "", 10))).toMatchObject({
      reason: "type",
    });
    expect(checkVideoFile(file("a.mp4", "video/mp4", 0))).toMatchObject({
      reason: "empty",
    });
  });

  it("rejects files over 250 MB and flags those within the 10 GB roadmap", () => {
    expect(
      checkVideoFile(file("a.mp4", "video/mp4", MAX_VIDEO_BYTES + 1)),
    ).toEqual({
      ok: false,
      reason: "size",
      heavy: true,
    });
    expect(
      checkVideoFile(file("a.mov", "video/quicktime", 11 * 1024 * MB)),
    ).toEqual({
      ok: false,
      reason: "size",
      heavy: false,
    });
  });
});

describe("format helpers", () => {
  it("formats timestamps, seconds and sizes", () => {
    expect(formatTimestamp(83.9)).toBe("01:23");
    expect(formatTimestamp(3725)).toBe("1:02:05");
    expect(formatClipTime(12)).toBe("00:12");
    expect(formatClipTime(0.9)).toBe("00:00.9");
    expect(formatClipTime(12.46)).toBe("00:12.5");
    expect(formatClipTime(59.96)).toBe("01:00");
    expect(formatClipTime(3725.2)).toBe("1:02:05.2");
    expect(formatSeconds(12.25)).toBe("12.3");
    expect(formatSeconds(30)).toBe("30");
    expect(formatBytes(MAX_VIDEO_BYTES)).toBe("250 MB");
    expect(formatBytes(1.5 * 1024 * MB)).toBe("1.5 GB");
    expect(formatBytes(512)).toBe("512 B");
  });
});

describe("nudgeRange", () => {
  const limits = { durationSec: 100, maxLength: 60 };

  it("moves one edge by the delta", () => {
    expect(nudgeRange({ start: 10, end: 40 }, "start", -1, limits)).toEqual({
      start: 9,
      end: 40,
    });
    expect(nudgeRange({ start: 10, end: 40 }, "end", 1, limits)).toEqual({
      start: 10,
      end: 41,
    });
  });

  it("stays inside the video", () => {
    expect(nudgeRange({ start: 0.4, end: 10 }, "start", -1, limits)).toEqual({
      start: 0,
      end: 10,
    });
    expect(nudgeRange({ start: 0, end: 10 }, "start", -1, limits)).toBeNull();
    expect(nudgeRange({ start: 90, end: 100 }, "end", 1, limits)).toBeNull();
  });

  it("keeps at least 1 s and at most the platform length when growing", () => {
    expect(nudgeRange({ start: 10, end: 11 }, "start", 1, limits)).toBeNull();
    expect(nudgeRange({ start: 10, end: 11 }, "end", -1, limits)).toBeNull();
    expect(nudgeRange({ start: 10, end: 70 }, "end", 1, limits)).toBeNull();
    // A clip already over the maximum can still be shortened.
    expect(nudgeRange({ start: 10, end: 80 }, "end", -1, limits)).toEqual({
      start: 10,
      end: 79,
    });
  });

  it("measures and compares ranges", () => {
    expect(rangeLength({ start: 10, end: 12.5 })).toBe(2.5);
    expect(sameRange({ start: 1, end: 2 }, { start: 1.01, end: 2 })).toBe(true);
    expect(sameRange({ start: 1, end: 2 }, { start: 1.5, end: 2 })).toBe(false);
  });
});

describe("dragging a clip edge", () => {
  const limits = { durationSec: 100, maxLength: 60 };

  it("bounds each edge by the video, the 1 s minimum and the platform maximum", () => {
    expect(edgeBounds({ start: 30, end: 50 }, "start", limits)).toEqual({
      min: 0,
      max: 49,
    });
    expect(edgeBounds({ start: 30, end: 50 }, "end", limits)).toEqual({
      min: 31,
      max: 90,
    });
    expect(edgeBounds({ start: 50, end: 90 }, "end", limits)).toEqual({
      min: 51,
      max: 100,
    });
    expect(edgeBounds({ start: 70, end: 80 }, "start", limits)).toEqual({
      min: 20,
      max: 79,
    });
    expect(
      edgeBounds({ start: 30, end: 50 }, "end", { durationSec: 100 }),
    ).toEqual({
      min: 31,
      max: 100,
    });
  });

  it("moves the edge to the pointer, snapped to 0.1 s and clamped", () => {
    const range = { start: 30, end: 50 };
    expect(setRangeEdge(range, "start", 12.345, limits)).toEqual({
      start: 12.3,
      end: 50,
    });
    expect(setRangeEdge(range, "start", 49.8, limits)).toEqual({
      start: 49,
      end: 50,
    });
    expect(setRangeEdge(range, "start", -4, limits)).toEqual({
      start: 0,
      end: 50,
    });
    expect(setRangeEdge(range, "end", 120, limits)).toEqual({
      start: 30,
      end: 90,
    });
    expect(setRangeEdge(range, "end", 30.2, limits)).toEqual({
      start: 30,
      end: 31,
    });
  });
});

describe("moving a whole clip", () => {
  it("keeps the length, snaps to 0.1 s and stays inside the video", () => {
    const range = { start: 30, end: 50 };
    expect(moveRange(range, 41.26, 100)).toEqual({ start: 41.3, end: 61.3 });
    expect(moveRange(range, -8, 100)).toEqual({ start: 0, end: 20 });
    expect(moveRange(range, 95, 100)).toEqual({ start: 80, end: 100 });
    expect(moveRange({ start: 0, end: 16.01 }, 3, 16.01)).toEqual({
      start: 0,
      end: 16.01,
    });
  });
});

describe("clip export helpers", () => {
  it("prefers MP4, then WebM, or nothing", () => {
    expect(pickRecorderFormat(() => true)).toEqual({
      mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      extension: "mp4",
    });
    expect(
      pickRecorderFormat((type) => type.startsWith("video/webm;codecs=vp8")),
    ).toEqual({
      mimeType: "video/webm;codecs=vp8,opus",
      extension: "webm",
    });
    // Safari: only a bare MP4 (H.264 by default).
    expect(pickRecorderFormat((type) => type === "video/mp4")).toEqual({
      mimeType: "video/mp4",
      extension: "mp4",
    });
    // Chromium without H.264 accepts a bare MP4 too, but WebM wins.
    expect(
      pickRecorderFormat((type) =>
        ["video/mp4", "video/webm;codecs=vp9,opus"].includes(type),
      ),
    ).toEqual({ mimeType: "video/webm;codecs=vp9,opus", extension: "webm" });
    expect(pickRecorderFormat(() => false)).toBeNull();
  });

  it("keeps the original framing, capped at 1920 px", () => {
    expect(exportGeometry(3840, 2160, "original")).toEqual({
      width: 1920,
      height: 1080,
      sx: 0,
      sy: 0,
      sw: 3840,
      sh: 2160,
    });
    expect(exportGeometry(1280, 720, "original")).toMatchObject({
      width: 1280,
      height: 720,
    });
  });

  it("centre-crops 9:16 for vertical exports (landscape and tall sources)", () => {
    expect(exportGeometry(1920, 1080, "vertical")).toEqual({
      width: 608,
      height: 1080,
      sx: 656,
      sy: 0,
      sw: 608,
      sh: 1080,
    });
    // Square source: the sides are cropped, the full height is kept.
    expect(exportGeometry(1000, 1000, "vertical")).toMatchObject({
      sw: 563,
      sh: 1000,
      sy: 0,
    });
    // Taller than 9:16: crop top and bottom.
    expect(exportGeometry(1080, 2400, "vertical")).toMatchObject({
      sx: 0,
      sw: 1080,
      sh: 1920,
      sy: 240,
      width: 1080,
      height: 1920,
    });
  });

  it("scales the bitrate with the size, within 1.5–8 Mbps", () => {
    expect(videoBitrate(320, 240)).toBe(1_500_000);
    expect(videoBitrate(1080, 1920)).toBe(6_220_800);
    expect(videoBitrate(3840, 2160)).toBe(8_000_000);
  });

  it("names clips after the source, the index and the time range", () => {
    expect(
      clipFileName("My Vlog (final).mp4", 2, { start: 83, end: 110.6 }, "mp4"),
    ).toBe("my-vlog-final-clip-2-01m23s-01m50s.mp4");
    expect(
      clipFileName("Canción ñandú.MOV", 1, { start: 3725, end: 3750 }, "webm"),
    ).toBe("cancion-nandu-clip-1-1h02m05s-1h02m30s.webm");
    expect(clipFileName("🎬.mp4", 3, { start: 0, end: 5 }, "mp4")).toBe(
      "video-clip-3-00m00s-00m05s.mp4",
    );
  });
});
