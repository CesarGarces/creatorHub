/**
 * Page-level flow of the AI Video Analyzer & Smart Clipper: local upload →
 * keyframes → cost → analysis → results → preview → client-side export.
 * Browser media work (decoding, canvas, MediaRecorder) is mocked at the
 * module boundary; the rest of the page, store and components is real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.setConfig({ testTimeout: 20_000 });

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
// The real selector loads vision models from the API; here it picks one.
vi.mock("@/components/provider-select", async () => {
  const { useEffect } = await import("react");
  return {
    ProviderSelect: ({
      value,
      requireVision,
      onChange,
    }: {
      value: string;
      requireVision?: boolean;
      onChange: (id: string, option: { displayName: string }) => void;
    }) => {
      useEffect(() => {
        if (!value)
          onChange("google/gemini-2.5-flash", {
            displayName: "Gemini 2.5 Flash",
          });
      }, [value, onChange]);
      return (
        <div
          data-testid="provider-select"
          data-vision={String(!!requireVision)}
        >
          {value}
        </div>
      );
    },
  };
});
vi.mock("@/lib/video-clipper/video-file", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/video-clipper/video-file")>()),
  readVideoMetadata: vi.fn(),
}));
vi.mock("@/lib/video-clipper/keyframes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/video-clipper/keyframes")>()),
  extractKeyframes: vi.fn(),
}));
vi.mock("@/lib/video-clipper/clip-export", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/video-clipper/clip-export")>()),
  exportClip: vi.fn(),
  downloadBlob: vi.fn(),
  isClipExportSupported: () => true,
}));

import { toast } from "sonner";
import api from "@/lib/api";
import VideoClipperPage from "@/app/(authed)/tools/video-clipper/page";
import { useVideoClipperStore } from "@/store/video-clipper.store";
import { useCreditsStore } from "@/store/credits.store";
import { readVideoMetadata } from "@/lib/video-clipper/video-file";
import { extractKeyframes, keyframeCount } from "@/lib/video-clipper/keyframes";
import { downloadBlob, exportClip } from "@/lib/video-clipper/clip-export";
import type { Keyframe, VideoAnalysisResult } from "@/lib/video-clipper/types";
import { routerMock } from "../mocks/next-navigation";

const apiMock = vi.mocked(api);
const DURATION = 120;
const FRAMES = keyframeCount(DURATION); // 18

const RESULT: VideoAnalysisResult = {
  summary: "A fresh pasta recipe.",
  contentType: "tutorial",
  highlights: [
    {
      id: "h1",
      start: 10,
      end: 35,
      title: "The dough",
      hook: "Only 2 ingredients",
      reason: "Simple",
      score: 74,
      tags: [],
    },
    {
      id: "h2",
      start: 60,
      end: 90,
      title: "The sauce",
      hook: "Nobody tells you this",
      reason: "Payoff",
      score: 93,
      tags: ["food"],
    },
  ],
  hooks: [{ text: "Stop buying dry pasta", style: "bold-claim" }],
  titles: [{ text: "Fresh pasta in 10 minutes", platform: "youtube" }],
  hashtags: ["#pasta"],
  platform: "tiktok",
  language: "en",
  video: {
    fileName: "vlog.mp4",
    durationSec: DURATION,
    width: 1920,
    height: 1080,
  },
  frames: FRAMES,
  model: { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
};

let balance = 100;
let play: ReturnType<typeof vi.spyOn>;

function videoFile(name = "vlog.mp4", size?: number): File {
  const file = new File(["x"], name, { type: "video/mp4" });
  if (size) Object.defineProperty(file, "size", { value: size });
  return file;
}

function upload(file: File) {
  fireEvent.change(screen.getByTestId("video-file-input"), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useVideoClipperStore.setState(useVideoClipperStore.getInitialState(), true);
  useCreditsStore.setState({ balance: 0 });
  balance = 100;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:local"),
      revokeObjectURL: vi.fn(),
    }),
  );
  play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});

  vi.mocked(readVideoMetadata).mockResolvedValue({
    durationSec: DURATION,
    width: 1920,
    height: 1080,
  });
  vi.mocked(extractKeyframes).mockImplementation(
    async (_url, timestamps, options) => {
      const frames: Keyframe[] = [];
      for (const timestamp of timestamps) {
        const frame = {
          timestamp,
          dataUrl: `data:image/jpeg;base64,F${timestamp}`,
        };
        frames.push(frame);
        options?.onProgress?.(frames.length, timestamps.length, frame);
      }
      return frames;
    },
  );
  apiMock.get.mockImplementation(
    async (path: string, options?: { params?: Record<string, string> }) => {
      if (path === "/credits/balance")
        return {
          balance,
          currentCredits: balance,
          purchasedCredits: 0,
          plan: "FREE",
        };
      if (path === "/tools/video-clipper/estimate") {
        const frames = Number(options?.params?.frames);
        return {
          data: {
            modelId: "google/gemini-2.5-flash",
            modelName: "Gemini 2.5 Flash",
            modelCost: 4,
            frames,
            units: Math.ceil(frames / 12),
            total: 4 * Math.ceil(frames / 12),
          },
        };
      }
      if (path === "/tools/video-clipper/analyses") return { data: [] };
      throw new Error(`Unexpected GET ${path}`);
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Video Clipper page", () => {
  it("analyzes a local video and exports a clip, without uploading the video", async () => {
    apiMock.post.mockResolvedValue({
      data: { analysisId: "va1", result: RESULT, creditsCharged: 8 },
    });
    render(<VideoClipperPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AI Video Analyzer & Smart Clipper",
      }),
    ).toBeTruthy();
    expect(screen.getByTestId("heavy-files-note")).toBeTruthy();
    expect(screen.getByTestId("provider-select").dataset.vision).toBe("true");

    // 1. Local ingest: object URL + keyframes planned from the duration.
    upload(videoFile());
    await screen.findByRole("heading", { name: `${FRAMES} keyframes` });
    expect(screen.getByTestId("video-player").getAttribute("src")).toBe(
      "blob:local",
    );
    expect(vi.mocked(extractKeyframes).mock.calls[0]![1]).toHaveLength(FRAMES);
    expect(screen.getByText("02:00 · 1920×1080 · 1 B")).toBeTruthy();

    // 2. Cost for this model and number of keyframes, with the balance.
    const cost = await screen.findByTestId("analysis-cost");
    expect(cost.textContent).toContain("This analysis costs 8 credits");
    expect(cost.textContent).toContain("Your balance: 100 credits");

    // 3. Analyze: keyframes + metadata only, in the UI language.
    fireEvent.click(screen.getByRole("radio", { name: "TikTok" }));
    fireEvent.change(
      screen.getByLabelText("What's the video about? (optional)"),
      {
        target: { value: "Pasta recipe" },
      },
    );
    const analyze = screen.getByRole("button", { name: "Analyze video" });
    await waitFor(() =>
      expect((analyze as HTMLButtonElement).disabled).toBe(false),
    );
    balance = 92;
    fireEvent.click(analyze);

    await screen.findByRole("heading", { name: "Detected clips" });
    const [path, body] = apiMock.post.mock.calls[0]!;
    expect(path).toBe("/tools/video-clipper/analyses");
    expect(body).toMatchObject({
      model: "google/gemini-2.5-flash",
      platform: "tiktok",
      language: "en",
      context: "Pasta recipe",
      video: {
        fileName: "vlog.mp4",
        durationSec: DURATION,
        width: 1920,
        height: 1080,
        sizeBytes: 1,
      },
    });
    const sent = body as { frames: { image: string }[] };
    expect(sent.frames).toHaveLength(FRAMES);
    expect(
      sent.frames.every((f) => f.image.startsWith("data:image/jpeg;base64,")),
    ).toBe(true);
    expect(JSON.stringify(body)).not.toContain("blob:");

    // Credits: charged message + balance refreshed.
    expect(toast.success).toHaveBeenCalledWith(
      "Analysis ready · 8 credits used",
    );
    await waitFor(() => expect(useCreditsStore.getState().balance).toBe(92));

    // 4. Results: titles, hooks, clips on the timeline and as cards.
    expect(screen.getByText("Fresh pasta in 10 minutes")).toBeTruthy();
    expect(screen.getByText("Stop buying dry pasta")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Clip 2, 01:00 to 01:30" }),
    ).toBeTruthy();
    const card = screen.getByRole("article", { name: "The sauce" });

    // 5. Preview plays the segment and stops at its end.
    const player = screen.getByTestId("video-player") as HTMLVideoElement;
    fireEvent.click(within(card).getByRole("button", { name: "Preview" }));
    expect(player.currentTime).toBe(60);
    expect(play).toHaveBeenCalled();
    expect(within(card).getByRole("button", { name: "Stop" })).toBeTruthy();
    player.currentTime = 90.2;
    fireEvent.timeUpdate(player);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    expect(within(card).getByRole("button", { name: "Preview" })).toBeTruthy();

    // 6. Export in 9:16 after trimming: recorded and downloaded locally.
    fireEvent.click(screen.getByRole("radio", { name: "Vertical 9:16" }));
    fireEvent.click(
      within(card).getByRole("button", { name: "End 1 second earlier" }),
    );
    vi.mocked(exportClip).mockImplementation(async ({ onProgress }) => {
      onProgress?.(0.5);
      return {
        blob: new Blob(["clip"]),
        mimeType: "video/mp4",
        extension: "mp4",
        width: 608,
        height: 1080,
      };
    });
    fireEvent.click(within(card).getByRole("button", { name: "Export" }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(exportClip).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "blob:local",
        start: 60,
        end: 89,
        format: "vertical",
      }),
    );
    expect(vi.mocked(downloadBlob).mock.calls[0]![1]).toBe(
      "vlog-clip-2-01m00s-01m29s.mp4",
    );
    expect(toast.success).toHaveBeenCalledWith("Clip saved to your device");
  });

  it("rejects files over 250 MB and highlights the 10 GB roadmap", async () => {
    render(<VideoClipperPage />);
    upload(videoFile("camera.mov", 3 * 1024 ** 3));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "This video is 3.0 GB. The browser clipper supports files up to 250 MB.",
    );
    expect(screen.getByTestId("heavy-files-note").dataset.emphasized).toBe(
      "true",
    );
    expect(readVideoMetadata).not.toHaveBeenCalled();
    expect(
      (
        screen.getByRole("button", {
          name: "Analyze video",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("blocks the analysis when the balance is too low", async () => {
    balance = 3;
    render(<VideoClipperPage />);
    upload(videoFile());

    const cost = await screen.findByTestId("analysis-cost");
    await waitFor(() =>
      expect(cost.textContent).toContain("You don't have enough credits"),
    );
    expect(
      within(cost)
        .getByRole("link", { name: "Get credits" })
        .getAttribute("href"),
    ).toBe("/credits");
    expect(
      (
        screen.getByRole("button", {
          name: "Analyze video",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("shows the server's error and charges nothing when the analysis fails", async () => {
    apiMock.post.mockRejectedValue(
      new Error(
        "The model didn't return a valid analysis. Try again or choose another model.",
      ),
    );
    render(<VideoClipperPage />);
    upload(videoFile());
    const analyze = await screen.findByRole("button", {
      name: "Analyze video",
    });
    await waitFor(() =>
      expect((analyze as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyze);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "The model didn't return a valid analysis",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Detected clips" }),
    ).toBeNull();
  });

  it("reopens a past analysis and asks for the original video to clip it", async () => {
    apiMock.get.mockImplementation(async (path: string) => {
      if (path === "/credits/balance") return { balance: 50, plan: "FREE" };
      if (path === "/tools/video-clipper/analyses") {
        return {
          data: [
            {
              id: "va1",
              fileName: "vlog.mp4",
              durationSec: DURATION,
              frameCount: FRAMES,
              modelId: "google/gemini-2.5-flash",
              creditsCharged: 8,
              highlights: 2,
              topTitle: "Fresh pasta in 10 minutes",
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }
      if (path === "/tools/video-clipper/analyses/va1")
        return { data: { id: "va1", result: RESULT } };
      return { data: null };
    });
    render(<VideoClipperPage />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open the analysis of vlog.mp4",
      }),
    );
    await screen.findByRole("heading", { name: "Detected clips" });
    expect(
      screen.getByText(
        "Attach the original video (vlog.mp4) to preview and export these clips.",
      ),
    ).toBeTruthy();
    const card = screen.getByRole("article", { name: "The sauce" });
    expect(
      (
        within(card).getByRole("button", {
          name: "Export",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    // Same video attached again → clips become playable, analysis kept.
    upload(videoFile());
    await waitFor(() =>
      expect(
        (
          within(screen.getByRole("article", { name: "The sauce" })).getByRole(
            "button",
            {
              name: "Preview",
            },
          ) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    expect(useVideoClipperStore.getState().analysis?.id).toBe("va1");
  });
});

describe("Video Clipper page — leaving with a video in memory", () => {
  const beforeUnload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  async function analyzeLocalVideo() {
    apiMock.post.mockResolvedValue({
      data: { analysisId: "va1", result: RESULT, creditsCharged: 8 },
    });
    render(<VideoClipperPage />);
    expect(beforeUnload()).toBe(false); // nothing to lose yet
    upload(videoFile());
    await screen.findByRole("heading", { name: `${FRAMES} keyframes` });
    expect(screen.getByTestId("leave-notice").textContent).toBe(
      "Your video is only kept in this tab. If you refresh, close or leave this page, you'll need to add it again.",
    );
    const analyze = screen.getByRole("button", { name: "Analyze video" });
    await waitFor(() =>
      expect((analyze as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyze);
    await screen.findByRole("heading", { name: "Detected clips" });
  }

  it("warns on refresh/close and explains that the analysis will be deleted", async () => {
    await analyzeLocalVideo();
    expect(screen.getByTestId("leave-notice").textContent).toContain(
      "the video and this analysis will be deleted",
    );
    expect(beforeUnload()).toBe(true); // the browser shows its "Leave site?" prompt
    expect(apiMock.delete).not.toHaveBeenCalled(); // the user may still stay
  });

  it("asks before in-app navigation; leaving deletes the analysis", async () => {
    await analyzeLocalVideo();
    apiMock.delete.mockResolvedValue(undefined);

    fireEvent.click(screen.getByRole("link", { name: "Tools" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Leave this page?",
    });
    expect(dialog.textContent).toContain(
      "the video and its analysis will be deleted",
    );
    expect(routerMock.push).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Stay" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(apiMock.delete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Tools" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Leave and delete",
      }),
    );
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/tools"));
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/tools/video-clipper/analyses/va1",
      {
        keepalive: true,
      },
    );
    expect(useVideoClipperStore.getState().analysis).toBeNull();
  });

  it("after a refresh, the next visit finishes deleting the analysis before loading the history", async () => {
    await analyzeLocalVideo();
    // The page unloads: the keepalive request can't complete.
    apiMock.delete.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    window.dispatchEvent(new Event("pagehide"));
    expect(
      localStorage.getItem("creator_hub.video_clipper.pending_deletions"),
    ).toBe('["va1"]');
    cleanup();

    // Reloaded page.
    useVideoClipperStore.setState(useVideoClipperStore.getInitialState(), true);
    vi.clearAllMocks();
    apiMock.delete.mockResolvedValue(undefined);
    render(<VideoClipperPage />);

    await waitFor(() =>
      expect(apiMock.delete).toHaveBeenCalledWith(
        "/tools/video-clipper/analyses/va1",
      ),
    );
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(
        "/tools/video-clipper/analyses",
        {
          params: { limit: "10" },
        },
      ),
    );
    const deleteOrder = apiMock.delete.mock.invocationCallOrder[0]!;
    const historyOrder =
      apiMock.get.mock.invocationCallOrder[
        apiMock.get.mock.calls.findIndex(
          ([path]) => path === "/tools/video-clipper/analyses",
        )
      ]!;
    expect(deleteOrder).toBeLessThan(historyOrder);
    expect(
      localStorage.getItem("creator_hub.video_clipper.pending_deletions"),
    ).toBeNull();
  });

  it("does not delete an analysis reopened from history without its video", async () => {
    useVideoClipperStore.setState({ analysis: { id: "va9", result: RESULT } });
    render(<VideoClipperPage />);
    expect(beforeUnload()).toBe(false);
    window.dispatchEvent(new Event("pagehide"));
    expect(apiMock.delete).not.toHaveBeenCalled();
  });
});

describe("Video Clipper page — trimming on the timeline", () => {
  it("a dragged handle trims the clip card, seeks the player and is what gets exported", async () => {
    apiMock.post.mockResolvedValue({
      data: { analysisId: "va1", result: RESULT, creditsCharged: 8 },
    });
    render(<VideoClipperPage />);
    upload(videoFile());
    await screen.findByRole("heading", { name: `${FRAMES} keyframes` });
    const analyze = screen.getByRole("button", { name: "Analyze video" });
    await waitFor(() =>
      expect((analyze as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(analyze);
    await screen.findByRole("heading", { name: "Detected clips" });

    // Clip 2 selected on the timeline → its handles appear.
    fireEvent.click(
      screen.getByRole("button", { name: "Clip 2, 01:00 to 01:30" }),
    );
    const end = screen.getByRole("slider", { name: "End of clip 2" });
    const bar = screen.getByRole("group", { name: "Clip timeline" });
    // 1 px per second of the 120 s video.
    vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 120,
      top: 0,
      height: 40,
      right: 120,
      bottom: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerDown(end, {
      pointerId: 3,
      button: 0,
      clientX: 90,
      pointerType: "touch",
    });
    fireEvent.pointerMove(end, {
      pointerId: 3,
      clientX: 84.5,
      pointerType: "touch",
    });
    fireEvent.pointerUp(end, { pointerId: 3 });

    const card = screen.getByRole("article", { name: "The sauce" });
    expect(within(card).getByText("01:00 – 01:24.5")).toBeTruthy();
    expect(within(card).getByText("Trimmed")).toBeTruthy();
    const player = screen.getByTestId("video-player") as HTMLVideoElement;
    expect(player.currentTime).toBe(84.5);

    vi.mocked(exportClip).mockResolvedValue({
      blob: new Blob(["clip"]),
      mimeType: "video/mp4",
      extension: "mp4",
      width: 1920,
      height: 1080,
    });
    fireEvent.click(within(card).getByRole("button", { name: "Export" }));
    await waitFor(() =>
      expect(exportClip).toHaveBeenCalledWith(
        expect.objectContaining({ start: 60, end: 84.5 }),
      ),
    );
  });
});
