import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/video-clipper/video-file", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/video-clipper/video-file")>()),
  readVideoMetadata: vi.fn(),
}));
vi.mock("@/lib/video-clipper/keyframes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/video-clipper/keyframes")>()),
  extractKeyframes: vi.fn(),
}));

import { useLocalVideo } from "@/hooks/use-local-video";
import { readVideoMetadata } from "@/lib/video-clipper/video-file";
import { extractKeyframes } from "@/lib/video-clipper/keyframes";

const file = (name: string, size = 1) => {
  const f = new File(["x"], name, { type: "video/mp4" });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

let urls = 0;
const revoke = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  urls = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => `blob:${++urls}`),
      revokeObjectURL: revoke,
    }),
  );
  vi.mocked(readVideoMetadata).mockResolvedValue({
    durationSec: 30,
    width: 1280,
    height: 720,
  });
  vi.mocked(extractKeyframes).mockImplementation(async (_url, ts) =>
    ts.map((timestamp) => ({ timestamp, dataUrl: "data:image/jpeg;base64,A" })),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("useLocalVideo", () => {
  it("opens the file locally, reads it and samples keyframes", async () => {
    const { result } = renderHook(() => useLocalVideo());
    let ok = false;
    await act(async () => {
      ok = await result.current.selectFile(file("a.mp4"));
    });
    expect(ok).toBe(true);
    expect(result.current).toMatchObject({
      status: "ready",
      url: "blob:1",
      info: {
        fileName: "a.mp4",
        durationSec: 30,
        width: 1280,
        height: 720,
        sizeBytes: 1,
      },
      plannedFrames: 11,
      error: null,
    });
    expect(result.current.frames).toHaveLength(11);
  });

  it("keeps the current video when a rejected file is picked", async () => {
    const { result } = renderHook(() => useLocalVideo());
    await act(async () => {
      await result.current.selectFile(file("a.mp4"));
    });
    await act(async () => {
      await result.current.selectFile(file("huge.mov", 300 * 1024 * 1024));
    });
    expect(result.current).toMatchObject({
      status: "ready",
      url: "blob:1",
      error: "size",
      heavy: true,
      rejectedSize: 300 * 1024 * 1024,
    });
    act(() => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it("reports videos the browser can't decode", async () => {
    vi.mocked(readVideoMetadata).mockRejectedValue(new Error("decode"));
    const { result } = renderHook(() => useLocalVideo());
    await act(async () => {
      await result.current.selectFile(file("a.mkv"));
    });
    expect(result.current).toMatchObject({ status: "error", error: "decode" });
  });

  it("aborts the previous sampling and revokes its URL when another file is picked", async () => {
    let firstSignal: AbortSignal | undefined;
    vi.mocked(extractKeyframes).mockImplementationOnce(
      (_url, _ts, options) =>
        new Promise((_, reject) => {
          firstSignal = options?.signal;
          options?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const { result, unmount } = renderHook(() => useLocalVideo());
    let first: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.selectFile(file("a.mp4"));
    });
    await waitFor(() => expect(result.current.status).toBe("sampling"));

    await act(async () => {
      await result.current.selectFile(file("b.mp4"));
    });
    expect(firstSignal?.aborted).toBe(true);
    await expect(first).resolves.toBe(false);
    expect(revoke).toHaveBeenCalledWith("blob:1");
    expect(result.current).toMatchObject({ status: "ready", url: "blob:2" });

    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:2");
  });

  it("clears everything", async () => {
    const { result } = renderHook(() => useLocalVideo());
    await act(async () => {
      await result.current.selectFile(file("a.mp4"));
    });
    act(() => result.current.clear());
    expect(result.current).toMatchObject({
      status: "idle",
      url: null,
      frames: [],
      info: null,
    });
    expect(revoke).toHaveBeenCalledWith("blob:1");
  });
});
