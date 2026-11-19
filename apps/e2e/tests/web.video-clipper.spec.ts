import path from "node:path";
import fs from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { mockApi, type ApiMock } from "../fixtures/api-mock";
import { signInWeb } from "../fixtures/web-data";
import { webPageRoutes } from "../fixtures/web-pages";
import { expectAccessible } from "../fixtures/a11y";
import {
  VIEWPORTS,
  expectNoHorizontalOverflow,
  expectTouchTarget,
} from "../fixtures/responsive";

/**
 * AI Video Analyzer & Smart Clipper with a real video in real Chromium:
 * local decoding, canvas keyframes, the request sent to the API (keyframes
 * + metadata only), segment preview and MediaRecorder export/download.
 * Only the backend is mocked.
 *
 * Fixture (VP9/Opus — Playwright's Chromium has no H.264 decoder):
 *   ffmpeg -f lavfi -i "testsrc2=size=640x360:rate=24:duration=16" \
 *     -f lavfi -i "sine=frequency=440:duration=16" -c:v libvpx-vp9 -b:v 60k \
 *     -g 48 -c:a libopus -b:a 16k -shortest fixtures/media/clip-16s.webm
 */

const VIDEO = path.join(__dirname, "../fixtures/media/clip-16s.webm");
/** web: keyframeCount(16 s) = round(6 + 5·log2(1 + 16/30)). */
const KEYFRAMES = 9;

interface AnalyzeBody {
  model: string;
  platform: string;
  language: string;
  video: {
    fileName: string;
    durationSec: number;
    width: number;
    height: number;
  };
  frames: { timestamp: number; image: string }[];
}

function analysisFor(body: AnalyzeBody) {
  return {
    summary: "Test pattern with a moving clock and a steady tone.",
    contentType: "test",
    highlights: [
      {
        id: "h1",
        start: 2,
        end: 5,
        title: "The countdown",
        hook: "Watch the clock",
        reason: "Motion",
        score: 90,
        tags: [],
      },
      {
        id: "h2",
        start: 9,
        end: 14,
        title: "Colour bars",
        hook: "Spot the change",
        reason: "Contrast",
        score: 70,
        tags: [],
      },
    ],
    hooks: [{ text: "Can you read the clock?", style: "question" }],
    titles: [{ text: "16 seconds of test pattern", platform: "youtube" }],
    hashtags: ["#test"],
    platform: body.platform,
    language: body.language,
    video: { ...body.video },
    frames: body.frames.length,
    model: { id: body.model, name: "Gemini 2.5 Flash" },
  };
}

async function loadVideo(page: Page) {
  await page.getByTestId("video-file-input").setInputFiles(VIDEO);
  await expect(
    page.getByRole("heading", { name: `${KEYFRAMES} keyframes` }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Keyframe at / })).toHaveCount(
    KEYFRAMES,
    {
      timeout: 30_000,
    },
  );
}

test.describe("Video Clipper · real video in the browser", () => {
  test("samples keyframes, analyzes them, previews and exports a clip locally", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const api = await mockApi(
      context,
      {
        ...webPageRoutes,
        "POST /tools/video-clipper/analyses": ({
          body,
        }: {
          body: unknown;
        }) => ({
          success: true,
          data: {
            analysisId: "va-new",
            result: analysisFor(body as AnalyzeBody),
            creditsCharged: 4,
          },
        }),
      },
      baseURL!,
    );
    await signInWeb(context, baseURL!);
    await page.goto("/tools/video-clipper");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "AI Video Analyzer & Smart Clipper",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", {
        name: "Heavy camera files up to 10 GB",
      }),
    ).toBeVisible();

    // ── Local ingest: the video plays from a blob: URL, keyframes are real frames.
    await loadVideo(page);
    await expect(page.getByTestId("video-player")).toHaveAttribute(
      "src",
      /^blob:/,
    );
    await expect(page.getByText(/^00:16 · 640×360 · /)).toBeVisible();
    const thumbs = await page
      .getByRole("img", { name: /^Keyframe at / })
      .evaluateAll((imgs) =>
        (imgs as HTMLImageElement[]).map((img) => img.src),
      );
    expect(
      thumbs.every((src) => src.startsWith("data:image/jpeg;base64,")),
    ).toBe(true);
    // Different moments of testsrc2 → different pictures (seeking worked).
    expect(new Set(thumbs).size).toBe(KEYFRAMES);

    // ── Cost (4 credits × 1 unit for 9 keyframes) and analysis.
    await expect(page.getByTestId("analysis-cost")).toContainText(
      "This analysis costs 4 credits",
    );
    await page
      .getByRole("radio", { name: "Instagram Reels" })
      .check({ force: true });
    await page.getByRole("button", { name: "Analyze video" }).click();
    await expect(
      page.getByRole("heading", { name: "Detected clips" }),
    ).toBeVisible();

    const [request] = api.calls("POST", "/tools/video-clipper/analyses");
    const body = request!.body as AnalyzeBody;
    expect(body).toMatchObject({
      model: "google/gemini-2.5-flash",
      platform: "instagram-reels",
      language: "en",
      video: { fileName: "clip-16s.webm", width: 640, height: 360 },
    });
    expect(body.video.durationSec).toBeCloseTo(16, 0);
    expect(body.frames).toHaveLength(KEYFRAMES);
    const times = body.frames.map((f) => f.timestamp);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBeGreaterThan(0);
    expect(times.at(-1)).toBeLessThan(16);
    for (const frame of body.frames) {
      expect(frame.image).toMatch(/^data:image\/jpeg;base64,/);
      expect(frame.image.length).toBeLessThan(600_000);
    }
    // Only keyframes + metadata: far smaller than the 174 KB video itself
    // would be once base64-encoded, and no blob/object URL leaks out.
    expect(JSON.stringify(body)).not.toContain("blob:");

    await expect(page.getByText("16 seconds of test pattern")).toBeVisible();
    const card = page.getByRole("article", { name: "The countdown" });
    await expect(card.getByText("00:02 – 00:05")).toBeVisible();

    // ── Preview plays the segment and stops at its end.
    await card.getByRole("button", { name: "Preview" }).click();
    await expect(card.getByRole("button", { name: "Stop" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Preview" })).toBeVisible({
      timeout: 15_000,
    });
    const stoppedAt = await page
      .getByTestId("video-player")
      .evaluate((v: HTMLVideoElement) => ({
        time: v.currentTime,
        paused: v.paused,
      }));
    expect(stoppedAt.paused).toBe(true);
    expect(stoppedAt.time).toBeGreaterThanOrEqual(4.7);
    expect(stoppedAt.time).toBeLessThan(6);

    // ── Export 9:16: recorded in the browser, downloaded to the device.
    await page
      .getByRole("radio", { name: "Vertical 9:16" })
      .check({ force: true });
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await card.getByRole("button", { name: "Export" }).click();
    await expect(card.getByRole("progressbar")).toBeVisible();
    const download = await downloadPromise;
    // The confirmation toast (checked now: it goes away after a few seconds).
    await expect(page.getByText("Clip saved to your device")).toBeVisible();
    expect(download.suggestedFilename()).toMatch(
      /^clip-16s-clip-1-00m02s-00m05s\.(webm|mp4)$/,
    );
    const file = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(file);
    expect(fs.statSync(file).size).toBeGreaterThan(5_000);

    // The exported file is a playable ~3 s vertical video.
    const exported = await page.evaluate(
      async (bytes: number[]) => {
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)]));
        const video = document.createElement("video");
        video.muted = true;
        video.src = url;
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = reject;
        });
        if (!Number.isFinite(video.duration)) {
          await new Promise((resolve) => {
            video.ondurationchange = resolve;
            video.currentTime = Number.MAX_SAFE_INTEGER;
          });
        }
        return {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        };
      },
      [...fs.readFileSync(file)],
    );
    expect(exported.height).toBe(360);
    expect(exported.width).toBe(202); // 9:16 centre crop of 640×360
    expect(exported.duration).toBeGreaterThan(2.5);
    expect(exported.duration).toBeLessThan(4);
  });

  test.describe("phone", () => {
    test.use(VIEWPORTS.phone.use);

    test("results fit the screen, are accessible and have thumb-sized controls", async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      await mockApi(
        context,
        {
          ...webPageRoutes,
          "/tools/video-clipper/analyses/va-1": {
            success: true,
            data: {
              id: "va-1",
              result: analysisFor({
                model: "google/gemini-2.5-flash",
                platform: "youtube-shorts",
                language: "en",
                video: {
                  fileName: "pasta-vlog.mp4",
                  durationSec: 16,
                  width: 640,
                  height: 360,
                },
                frames: [],
              }),
            },
          },
        },
        baseURL!,
      );
      await signInWeb(context, baseURL!);
      await page.goto("/tools/video-clipper");
      await page
        .getByRole("button", { name: "Open the analysis of pasta-vlog.mp4" })
        .tap();
      await expect(
        page.getByRole("heading", { name: "Detected clips" }),
      ).toBeVisible();
      await expect(
        page.getByText(
          "Attach the original video (pasta-vlog.mp4) to preview and export these clips.",
        ),
      ).toBeVisible();

      await expectNoHorizontalOverflow(page);
      const card = page.getByRole("article", { name: "The countdown" });
      await expectTouchTarget(card.getByRole("button", { name: "Preview" }));
      await expectTouchTarget(
        card.getByRole("button", { name: "Start 1 second later" }),
      );
      await expectTouchTarget(
        card.getByRole("button", { name: "Copy “Watch the clock”" }),
      );
      await expectTouchTarget(
        page.getByRole("radio", { name: "TikTok" }).locator(".."),
      );

      // Attaching the same video enables preview/export on the phone too.
      await page.getByTestId("video-file-input").setInputFiles(VIDEO);
      await expect(card.getByRole("button", { name: "Preview" })).toBeEnabled({
        timeout: 30_000,
      });
      await expect(
        page.getByRole("img", { name: /^Keyframe at / }),
      ).toHaveCount(KEYFRAMES, { timeout: 30_000 });
      await expectNoHorizontalOverflow(page);
      // Axe gate on the full results screen (player, timeline, clips, suggestions).
      await expectAccessible(
        page,
        testInfo,
        "phone /tools/video-clipper (results)",
      );
    });
  });
});

test.describe("Video Clipper · leaving with the video in memory", () => {
  test.setTimeout(120_000);

  async function analyzed(
    page: Page,
    context: BrowserContext,
    baseURL: string,
  ) {
    const api = await mockApi(
      context,
      {
        ...webPageRoutes,
        "POST /tools/video-clipper/analyses": ({
          body,
        }: {
          body: unknown;
        }) => ({
          success: true,
          data: {
            analysisId: "va-new",
            result: analysisFor(body as AnalyzeBody),
            creditsCharged: 4,
          },
        }),
        "DELETE /tools/video-clipper/analyses/va-new": { success: true },
      },
      baseURL,
    );
    await signInWeb(context, baseURL);
    await page.goto("/tools/video-clipper");
    await loadVideo(page);
    await page.getByRole("button", { name: "Analyze video" }).click();
    await expect(
      page.getByRole("heading", { name: "Detected clips" }),
    ).toBeVisible();
    await expect(page.getByTestId("leave-notice")).toContainText(
      "the video and this analysis will be deleted",
    );
    return api;
  }

  const deletions = (api: ApiMock) =>
    api.calls("DELETE", "/tools/video-clipper/analyses/va-new").length;

  test("refresh: staying keeps everything, leaving deletes the analysis", async ({
    page,
    context,
    baseURL,
  }) => {
    const api = await analyzed(page, context, baseURL!);

    // The browser's own "Leave site?" prompt — cancelled.
    const prompts: string[] = [];
    page.once("dialog", (dialog) => {
      prompts.push(dialog.type());
      void dialog.dismiss();
    });
    await page.reload({ timeout: 3_000 }).catch(() => undefined);
    expect(prompts).toEqual(["beforeunload"]);
    await expect(
      page.getByRole("heading", { name: "Detected clips" }),
    ).toBeVisible();
    await expect(page.getByTestId("video-player")).toHaveAttribute(
      "src",
      /^blob:/,
    );
    expect(deletions(api)).toBe(0);

    // Accepted: the page reloads and the analysis is gone.
    page.once("dialog", (dialog) => {
      prompts.push(dialog.type());
      void dialog.accept();
    });
    await page.reload();
    expect(prompts).toEqual(["beforeunload", "beforeunload"]);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect.poll(() => deletions(api)).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("video-dropzone")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Detected clips" }),
    ).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(() =>
          localStorage.getItem("creator_hub.video_clipper.pending_deletions"),
        ),
      )
      .toBeNull();
  });

  test("in-app navigation asks first; leaving deletes the analysis", async ({
    page,
    context,
    baseURL,
  }, testInfo) => {
    const api = await analyzed(page, context, baseURL!);

    await page.getByRole("link", { name: "Tools" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Leave this page?" });
    await expect(dialog).toContainText(
      "the video and its analysis will be deleted",
    );
    // The "Analysis ready" toast is excluded: sonner's success colours are
    // an app-wide style outside this screen (4.25:1, tracked separately).
    await expectAccessible(page, testInfo, "leave dialog", {
      exclude: ["[data-sonner-toaster]"],
    });
    await dialog.getByRole("button", { name: "Stay" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/tools\/video-clipper$/);

    await page.getByRole("link", { name: "Tools" }).first().click();
    await dialog.getByRole("button", { name: "Leave and delete" }).click();
    await expect(page).toHaveURL(/\/tools$/);
    await expect.poll(() => deletions(api)).toBe(1);
  });

  test("no prompt without a video in memory", async ({
    page,
    context,
    baseURL,
  }) => {
    await mockApi(context, webPageRoutes, baseURL!);
    await signInWeb(context, baseURL!);
    await page.goto("/tools/video-clipper");
    // A real interaction (browsers only prompt pages the user interacted with).
    await page.getByRole("radio", { name: "TikTok" }).check({ force: true });
    let prompted = false;
    page.on("dialog", (d) => {
      prompted = true;
      void d.accept();
    });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(prompted).toBe(false);
  });
});

test.describe("Video Clipper · trimming on the timeline", () => {
  test.setTimeout(120_000);

  async function selectedClip(
    page: Page,
    context: BrowserContext,
    baseURL: string,
  ) {
    await mockApi(
      context,
      {
        ...webPageRoutes,
        "POST /tools/video-clipper/analyses": ({
          body,
        }: {
          body: unknown;
        }) => ({
          success: true,
          data: {
            analysisId: "va-new",
            result: analysisFor(body as AnalyzeBody),
            creditsCharged: 4,
          },
        }),
      },
      baseURL,
    );
    await signInWeb(context, baseURL);
    await page.goto("/tools/video-clipper");
    await loadVideo(page);
    await page.getByRole("button", { name: "Analyze video" }).click();
    await expect(
      page.getByRole("heading", { name: "Detected clips" }),
    ).toBeVisible();
    // Clip 1 (00:02–00:05) selected on the timeline.
    await page.getByRole("button", { name: "Clip 1, 00:02 to 00:05" }).click();
    await page
      .getByTestId("video-player")
      .evaluate((v: HTMLVideoElement) => v.pause());
    const bar = page.getByRole("group", { name: "Clip timeline" });
    const box = (await bar.boundingBox())!;
    /** Viewport x of a time on the 16 s timeline. */
    const xAt = (seconds: number) => box.x + (seconds / 16) * box.width;
    return { xAt, y: box.y + box.height / 2 };
  }

  const card = (page: Page) =>
    page.getByRole("article", { name: "The countdown" });
  const playerTime = (page: Page) =>
    page
      .getByTestId("video-player")
      .evaluate((v: HTMLVideoElement) => v.currentTime);

  test("mouse: drag the end handle to lengthen the clip", async ({
    page,
    context,
    baseURL,
  }) => {
    const { xAt, y } = await selectedClip(page, context, baseURL!);
    const end = page.getByRole("slider", { name: "End of clip 1" });
    await expect(end).toHaveAttribute("aria-valuenow", "5");

    await page.mouse.move(xAt(5), y);
    await page.mouse.down();
    await page.mouse.move(xAt(6), y, { steps: 5 });
    await page.mouse.move(xAt(7.5), y, { steps: 5 });
    // Live time label while dragging.
    await expect(end).toHaveAttribute("data-dragging", "true");
    await expect(end).toContainText(/^00:07/);
    await page.mouse.up();

    await expect(end).not.toHaveAttribute("data-dragging", "true");
    const value = Number(await end.getAttribute("aria-valuenow"));
    expect(value).toBeGreaterThan(7.2);
    expect(value).toBeLessThan(7.8);
    await expect(card(page).getByText(/^00:02 – 00:07/)).toBeVisible();
    await expect(card(page).getByText("Trimmed")).toBeVisible();
    // The player shows the frame under the handle.
    expect(Math.abs((await playerTime(page)) - value)).toBeLessThan(0.2);
  });

  const clipLeft = (page: Page) =>
    page
      .getByTestId("timeline-clip-h1")
      .evaluate((el) => parseFloat((el as HTMLElement).style.left));

  test("mouse: press and hold the clip, then drag it — smooth, committed on release", async ({
    page,
    context,
    baseURL,
  }) => {
    const { xAt, y } = await selectedClip(page, context, baseURL!);
    const clip = page.getByTestId("timeline-clip-h1");

    // Hold on the middle of the clip (3.5 s) until it lifts.
    await page.mouse.move(xAt(3.5), y);
    await page.mouse.down();
    await expect(clip).toHaveAttribute("data-moving", "true", {
      timeout: 2_000,
    });

    // One quick jump of the pointer by +6 s: the clip glides, it doesn't teleport.
    await page.mouse.move(xAt(9.5), y);
    const samples: number[] = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await clipLeft(page));
      await page.waitForTimeout(25);
    }
    await expect.poll(() => clipLeft(page)).toBeCloseTo((8 / 16) * 100, 0);
    expect(new Set(samples.map((v) => v.toFixed(2))).size).toBeGreaterThan(1);
    await expect(page.getByTestId("timeline-move-label")).toHaveText(
      "00:08 – 00:11",
    );
    // Not committed while still holding.
    await expect(card(page).getByText(/^00:02 – 00:05/)).toBeVisible();

    await page.mouse.up();
    await expect(card(page).getByText(/^00:08 – 00:11/)).toBeVisible();
    await expect(clip).not.toHaveAttribute("data-moving", "true");
    // Same length (3 s), and no preview started by the release.
    await expect(
      card(page).getByRole("button", { name: "Preview" }),
    ).toBeVisible();
    expect(Math.abs((await playerTime(page)) - 8)).toBeLessThan(0.2);
  });

  test.describe("phone", () => {
    test.use(VIEWPORTS.phone.use);

    test("touch: press and hold the clip with a finger, then drag it", async ({
      page,
      context,
      baseURL,
    }) => {
      const { xAt, y } = await selectedClip(page, context, baseURL!);
      const clip = page.getByTestId("timeline-clip-h1");
      const scrollBefore = await page
        .locator("main")
        .evaluate((m) => m.scrollTop);
      const cdp = await context.newCDPSession(page);
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd",
        x: number,
      ) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        });

      await touch("touchStart", xAt(3.5));
      await expect(clip).toHaveAttribute("data-moving", "true", {
        timeout: 2_000,
      });
      for (const t of [4.5, 6, 7.5, 8.5]) {
        await touch("touchMove", xAt(t));
        await page.waitForTimeout(30);
      }
      await expect(page.getByTestId("timeline-move-label")).toHaveText(
        "00:07 – 00:10",
      );
      await touch("touchEnd", xAt(8.5));

      await expect(card(page).getByText(/^00:07 – 00:10/)).toBeVisible();
      await expect(clip).not.toHaveAttribute("data-moving", "true");
      expect(await page.locator("main").evaluate((m) => m.scrollTop)).toBe(
        scrollBefore,
      );
    });

    test("touch: drag the start handle with a finger, without scrolling the page", async ({
      page,
      context,
      baseURL,
    }) => {
      const { xAt, y } = await selectedClip(page, context, baseURL!);
      const start = page.getByRole("slider", { name: "Start of clip 1" });
      await expectTouchTarget(start);
      // Touch wording shown, mouse/keyboard wording hidden.
      const hint = page.getByTestId("timeline-hint");
      await expect(
        hint.getByText("Press and hold the clip, then drag it to move it."),
      ).toBeVisible();
      await expect(hint.getByText(/arrow keys/)).toBeHidden();
      const scrollBefore = await page
        .locator("main")
        .evaluate((m) => m.scrollTop);

      // A real touch gesture (Chrome DevTools Protocol touch events).
      const cdp = await context.newCDPSession(page);
      const touch = (
        type: "touchStart" | "touchMove" | "touchEnd",
        x: number,
      ) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x, y }],
        });
      await touch("touchStart", xAt(2));
      for (const t of [1.8, 1.5, 1.2, 1.0]) await touch("touchMove", xAt(t));
      await touch("touchEnd", xAt(1));

      const value = Number(await start.getAttribute("aria-valuenow"));
      expect(value).toBeGreaterThan(0.6);
      expect(value).toBeLessThan(1.4);
      await expect(card(page).getByText(/^00:01(\.\d)? – 00:05/)).toBeVisible();
      // `touch-action: none`: the drag didn't scroll the page.
      expect(await page.locator("main").evaluate((m) => m.scrollTop)).toBe(
        scrollBefore,
      );
      expect(Math.abs((await playerTime(page)) - value)).toBeLessThan(0.2);
    });
  });
});
