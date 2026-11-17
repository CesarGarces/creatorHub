import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { VideoDropzone } from "@/components/video-clipper/video-dropzone";
import { HeavyFilesNote } from "@/components/video-clipper/heavy-files-note";
import { KeyframeStrip } from "@/components/video-clipper/keyframe-strip";
import {
  ClipTimeline,
  LONG_PRESS_MS,
} from "@/components/video-clipper/clip-timeline";
import {
  ClipCard,
  type ClipCardProps,
} from "@/components/video-clipper/clip-card";
import { SuggestionsPanel } from "@/components/video-clipper/suggestions-panel";
import { AnalysisHistory } from "@/components/video-clipper/analysis-history";
import type { ClipRange, VideoHighlight } from "@/lib/video-clipper/types";

const FRAME = "data:image/jpeg;base64,AAAA";

describe("VideoDropzone", () => {
  it("passes picked and dropped files, and states the 250 MB limit and privacy", () => {
    const onFile = vi.fn();
    render(<VideoDropzone onFile={onFile} />);

    expect(screen.getByText("MP4, MOV or WebM, up to 250 MB")).toBeTruthy();
    expect(
      screen.getByText(/your video never leaves your device/),
    ).toBeTruthy();

    const file = new File(["x"], "vlog.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByTestId("video-file-input"), {
      target: { files: [file] },
    });
    expect(onFile).toHaveBeenLastCalledWith(file);

    const zone = screen.getByTestId("video-dropzone");
    fireEvent.dragOver(zone, {
      dataTransfer: { files: [file], dropEffect: "" },
    });
    expect(screen.getByText("Drop to load the video")).toBeTruthy();
    const dropped = new File(["y"], "clip.mov", { type: "video/quicktime" });
    fireEvent.drop(zone, { dataTransfer: { files: [dropped] } });
    expect(onFile).toHaveBeenLastCalledWith(dropped);
  });

  it("opens the file picker from the button", () => {
    render(<VideoDropzone onFile={vi.fn()} />);
    const input = screen.getByTestId("video-file-input") as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button", { name: "Choose video" }));
    expect(click).toHaveBeenCalled();
  });
});

describe("HeavyFilesNote", () => {
  it("announces the 10 GB heavy-file support as a future release", () => {
    const { rerender } = render(<HeavyFilesNote />);
    const note = screen.getByRole("complementary", {
      name: "Heavy camera files up to 10 GB",
    });
    expect(within(note).getByText("Coming soon")).toBeTruthy();
    expect(within(note).getByText(/coming in a future release/)).toBeTruthy();
    expect(note.dataset.emphasized).toBeUndefined();

    rerender(<HeavyFilesNote emphasized />);
    expect(screen.getByTestId("heavy-files-note").dataset.emphasized).toBe(
      "true",
    );
  });
});

describe("KeyframeStrip", () => {
  it("shows sampled keyframes, placeholders for the rest, and seeks on click", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <KeyframeStrip
        frames={[
          { timestamp: 5, dataUrl: FRAME },
          { timestamp: 15, dataUrl: FRAME },
        ]}
        total={4}
        durationSec={40}
        activeTime={14}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("heading", { name: "4 keyframes" })).toBeTruthy();
    expect(
      screen.getByText(
        "Sampled about every 10 s and compressed in your browser.",
      ),
    ).toBeTruthy();
    expect(screen.getByAltText("Keyframe at 00:15")).toBeTruthy();
    expect(container.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(
      2,
    );

    const active = screen.getByRole("button", { name: "Go to 00:15" });
    expect(active.getAttribute("aria-current")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Go to 00:05" }));
    expect(onSelect).toHaveBeenCalledWith(5);
  });
});

describe("ClipTimeline", () => {
  it("places clips on the bar and selects them", () => {
    const onSelect = vi.fn();
    render(
      <ClipTimeline
        durationSec={100}
        clips={[
          { id: "h1", index: 1, start: 10, end: 30, score: 80 },
          { id: "h2", index: 2, start: 50, end: 75, score: 60 },
        ]}
        activeId="h2"
        currentTime={25}
        onSelect={onSelect}
      />,
    );
    const first = screen.getByRole("button", {
      name: "Clip 1, 00:10 to 00:30",
    });
    expect(first.style.left).toBe("10%");
    expect(first.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Clip 2, 00:50 to 01:15" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByTestId("timeline-playhead").style.left).toBe("25%");
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalledWith("h1");
  });
});

/** Controlled like the page: ranges live in the parent. */
function TimelineHarness({
  activeId = "h1",
  onChange = vi.fn(),
  onScrub = vi.fn(),
  onSelect,
}: {
  activeId?: string | null;
  onChange?: (id: string, r: ClipRange) => void;
  onScrub?: (t: number) => void;
  onSelect?: (id: string) => void;
}) {
  const [ranges, setRanges] = useState<Record<string, ClipRange>>({
    h1: { start: 10, end: 30 },
    h2: { start: 50, end: 75 },
  });
  return (
    <ClipTimeline
      durationSec={100}
      maxLength={60}
      activeId={activeId}
      clips={[
        { id: "h1", index: 1, score: 80, ...ranges.h1! },
        { id: "h2", index: 2, score: 60, ...ranges.h2! },
      ]}
      onRangeChange={(id, range) => {
        onChange(id, range);
        setRanges((r) => ({ ...r, [id]: range }));
      }}
      onScrub={onScrub}
      onSelect={onSelect}
    />
  );
}

/** The bar spans x = 100…1100 px: 10 px per second. */
function mockTimelineBar() {
  const bar = screen.getByRole("group", { name: "Clip timeline" });
  vi.spyOn(bar, "getBoundingClientRect").mockReturnValue({
    left: 100,
    width: 1000,
    top: 0,
    height: 40,
    right: 1100,
    bottom: 40,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  });
}

describe("ClipTimeline — trimming the selected clip", () => {
  const handle = (edge: "Start" | "End", index = 1) =>
    screen.getByRole("slider", { name: `${edge} of clip ${index}` });

  it("shows start/end handles on the selected clip as sliders", () => {
    render(<TimelineHarness />);
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    const start = handle("Start");
    expect(start.getAttribute("aria-valuenow")).toBe("10");
    expect(start.getAttribute("aria-valuemin")).toBe("0");
    expect(start.getAttribute("aria-valuemax")).toBe("29");
    expect(start.getAttribute("aria-valuetext")).toBe("00:10");
    expect(handle("End").getAttribute("aria-valuemax")).toBe("70"); // 10 + 60 s max
    expect(screen.getByTestId("timeline-hint").textContent).toContain(
      "Drag the handles",
    );
  });

  it("drags an edge with the mouse and scrubs the player to it", () => {
    const onChange = vi.fn();
    const onScrub = vi.fn();
    render(<TimelineHarness onChange={onChange} onScrub={onScrub} />);
    mockTimelineBar();
    const start = handle("Start");

    fireEvent.pointerDown(start, {
      pointerId: 1,
      button: 0,
      clientX: 200,
      pointerType: "mouse",
    });
    expect(start.dataset.dragging).toBe("true");
    expect(onScrub).toHaveBeenLastCalledWith(10);
    fireEvent.pointerMove(start, {
      pointerId: 1,
      clientX: 252.3,
      pointerType: "mouse",
    });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 15.2, end: 30 });
    expect(onScrub).toHaveBeenLastCalledWith(15.2);
    expect(start.textContent).toContain("00:15.2"); // live time label
    expect(start.getAttribute("aria-valuenow")).toBe("15.2");

    fireEvent.pointerUp(start, { pointerId: 1 });
    expect(start.dataset.dragging).toBeUndefined();
    fireEvent.pointerMove(start, { pointerId: 1, clientX: 400 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("drags with a finger too, clamped to the platform maximum and the video", () => {
    const onChange = vi.fn();
    render(<TimelineHarness onChange={onChange} />);
    mockTimelineBar();
    const end = handle("End");

    fireEvent.pointerDown(end, {
      pointerId: 7,
      button: 0,
      clientX: 400,
      pointerType: "touch",
    });
    fireEvent.pointerMove(end, {
      pointerId: 7,
      clientX: 1500,
      pointerType: "touch",
    });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 10, end: 70 }); // 60 s max
    fireEvent.pointerMove(end, {
      pointerId: 7,
      clientX: 0,
      pointerType: "touch",
    });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 10, end: 11 }); // ≥ 1 s
    fireEvent.pointerCancel(end, { pointerId: 7 });
    expect(end.dataset.dragging).toBeUndefined();
  });

  it("adjusts with the keyboard: arrows 0.5 s, Shift 0.1 s, Page Up/Down 5 s, Home/End", () => {
    const onChange = vi.fn();
    render(<TimelineHarness onChange={onChange} />);
    const start = handle("Start");
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 10.5, end: 30 });
    fireEvent.keyDown(start, { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 10.4, end: 30 });
    fireEvent.keyDown(start, { key: "PageUp" });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 15.4, end: 30 });
    fireEvent.keyDown(start, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 0, end: 30 });
    fireEvent.keyDown(handle("End"), { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 0, end: 60 });
    fireEvent.keyDown(handle("End"), { key: "a" });
    expect(onChange).toHaveBeenCalledTimes(5);
  });

  it("has no handles when nothing is selected or trimming isn't offered", () => {
    const { unmount } = render(<TimelineHarness activeId={null} />);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    unmount();
    render(
      <ClipTimeline
        durationSec={100}
        activeId="h1"
        clips={[{ id: "h1", index: 1, start: 10, end: 30, score: 80 }]}
      />,
    );
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });
});

describe("ClipTimeline — press and hold to move the selected clip", () => {
  const FRAME = 1000 / 60;
  const segment = (id = "h1") => screen.getByTestId(`timeline-clip-${id}`);
  const leftPercent = (id = "h1") => parseFloat(segment(id).style.left);
  const frames = (n: number) => act(() => vi.advanceTimersByTime(FRAME * n));

  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "requestAnimationFrame",
        "cancelAnimationFrame",
        "performance",
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  function setup() {
    const onChange = vi.fn();
    const onScrub = vi.fn();
    const onSelect = vi.fn();
    const view = render(
      <TimelineHarness
        onChange={onChange}
        onScrub={onScrub}
        onSelect={onSelect}
      />,
    );
    mockTimelineBar();
    return { onChange, onScrub, onSelect, ...view };
  }

  /** Pointer down on the selected clip (x = 300 px → 20 s) and hold. */
  function holdClip(pointerType = "mouse", x = 300) {
    fireEvent.pointerDown(segment(), {
      pointerId: 1,
      button: 0,
      clientX: x,
      clientY: 20,
      pointerType,
    });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS));
  }

  it("a short press is still a click (select / preview)", () => {
    const { onSelect, onChange } = setup();
    fireEvent.pointerDown(segment(), {
      pointerId: 1,
      button: 0,
      clientX: 300,
      clientY: 20,
    });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS - 50));
    expect(segment().dataset.pressing).toBe("true"); // visual feedback while holding
    fireEvent.pointerUp(segment(), { pointerId: 1 });
    fireEvent.click(segment());
    expect(onSelect).toHaveBeenCalledWith("h1");
    expect(segment().dataset.moving).toBeUndefined();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("holding lifts the clip; it glides after the pointer and is committed on release", () => {
    const { onChange, onScrub, onSelect } = setup();
    holdClip("touch");
    expect(segment().dataset.moving).toBe("true");
    expect(onScrub).toHaveBeenLastCalledWith(10);

    // Drag 150 px right = +15 s.
    fireEvent.pointerMove(segment(), {
      pointerId: 1,
      clientX: 450,
      clientY: 20,
      pointerType: "touch",
    });
    expect(onScrub).toHaveBeenLastCalledWith(25);
    // Optimistic but smooth: not a jump, not committed yet.
    expect(leftPercent()).toBe(10);
    frames(1);
    const afterOne = leftPercent();
    expect(afterOne).toBeGreaterThan(10);
    expect(afterOne).toBeLessThan(25);
    frames(3);
    expect(leftPercent()).toBeGreaterThan(afterOne);
    expect(onChange).not.toHaveBeenCalled();
    frames(40);
    expect(leftPercent()).toBeCloseTo(25, 5);
    expect(screen.getByTestId("timeline-move-label").textContent).toBe(
      "00:25 – 00:45",
    );

    // Release → committed (same length), the trailing click doesn't select.
    fireEvent.pointerUp(segment(), { pointerId: 1, pointerType: "touch" });
    fireEvent.click(segment());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("h1", { start: 25, end: 45 });
    expect(onSelect).not.toHaveBeenCalled();
    frames(40);
    expect(segment().dataset.moving).toBeUndefined();
    expect(leftPercent()).toBe(25); // now from the committed props
    expect(screen.getByText("Clip 1 moved to 00:25 – 00:45")).toBeTruthy();

    // The next plain click works again.
    fireEvent.pointerDown(segment(), {
      pointerId: 2,
      button: 0,
      clientX: 350,
      clientY: 20,
    });
    fireEvent.pointerUp(segment(), { pointerId: 2 });
    fireEvent.click(segment());
    expect(onSelect).toHaveBeenCalledWith("h1");
  });

  it("moving before the delay is not a long press (tap, scroll)", () => {
    const { onChange } = setup();
    fireEvent.pointerDown(segment(), {
      pointerId: 1,
      button: 0,
      clientX: 300,
      clientY: 20,
      pointerType: "touch",
    });
    fireEvent.pointerMove(segment(), {
      pointerId: 1,
      clientX: 300,
      clientY: 40,
      pointerType: "touch",
    });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    expect(segment().dataset.moving).toBeUndefined();
    expect(segment().dataset.pressing).toBeUndefined();
    fireEvent.pointerMove(segment(), {
      pointerId: 1,
      clientX: 600,
      clientY: 40,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("a cancelled gesture or Escape puts the clip back without committing", () => {
    const { onChange } = setup();
    holdClip();
    fireEvent.pointerMove(segment(), {
      pointerId: 1,
      clientX: 500,
      clientY: 20,
    });
    frames(40);
    expect(leftPercent()).toBeCloseTo(30, 5);
    fireEvent.pointerCancel(segment(), { pointerId: 1 });
    frames(60);
    expect(leftPercent()).toBe(10);
    expect(segment().dataset.moving).toBeUndefined();

    holdClip();
    fireEvent.pointerMove(segment(), {
      pointerId: 1,
      clientX: 500,
      clientY: 20,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    frames(60);
    expect(leftPercent()).toBe(10);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the clip inside the video", () => {
    const { onChange } = setup();
    holdClip();
    fireEvent.pointerMove(segment(), {
      pointerId: 1,
      clientX: 5000,
      clientY: 20,
    });
    fireEvent.pointerUp(segment(), { pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith("h1", { start: 80, end: 100 });
  });

  it("only the selected clip can be picked up", () => {
    const { onChange } = setup();
    fireEvent.pointerDown(segment("h2"), {
      pointerId: 1,
      button: 0,
      clientX: 600,
      clientY: 20,
    });
    act(() => vi.advanceTimersByTime(LONG_PRESS_MS * 2));
    expect(segment("h2").dataset.moving).toBeUndefined();
    expect(segment("h2").className).not.toContain("touch-none");
    expect(segment("h1").className).toContain("touch-none");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves with the arrow keys too (Shift = 0.1 s)", () => {
    const { onChange } = setup();
    expect(segment().getAttribute("aria-keyshortcuts")).toBe(
      "ArrowLeft ArrowRight",
    );
    fireEvent.keyDown(segment(), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 10.5, end: 30.5 });
    fireEvent.keyDown(segment(), { key: "ArrowLeft", shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith("h1", { start: 10.4, end: 30.4 });
  });
});

const CLIP: VideoHighlight = {
  id: "h1",
  start: 10,
  end: 40,
  title: "The secret sauce",
  hook: "Nobody tells you this",
  reason: "Strong payoff",
  score: 88,
  tags: ["food"],
};

function renderCard(props: Partial<ClipCardProps> = {}) {
  const handlers = {
    onPreview: vi.fn(),
    onStop: vi.fn(),
    onExport: vi.fn(),
    onCancelExport: vi.fn(),
    onRangeChange: vi.fn(),
    onResetRange: vi.fn(),
    onCopy: vi.fn(),
  };
  render(
    <ClipCard
      clip={CLIP}
      index={1}
      range={{ start: 10, end: 40 }}
      durationSec={100}
      maxLength={60}
      canPlay
      exportSupported
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("ClipCard", () => {
  it("shows the clip, its score, hook and reason", () => {
    const { onCopy, onPreview, onExport } = renderCard();
    const card = screen.getByRole("article", { name: "The secret sauce" });
    expect(within(card).getByText("00:10 – 00:40")).toBeTruthy();
    expect(within(card).getByText("30 s")).toBeTruthy();
    expect(within(card).getByText("Score 88")).toBeTruthy();
    expect(within(card).getByText("“Nobody tells you this”")).toBeTruthy();
    expect(within(card).getByText("Strong payoff")).toBeTruthy();

    fireEvent.click(
      within(card).getByRole("button", {
        name: "Copy “Nobody tells you this”",
      }),
    );
    expect(onCopy).toHaveBeenCalledWith("Nobody tells you this");
    fireEvent.click(within(card).getByRole("button", { name: "Preview" }));
    expect(onPreview).toHaveBeenCalled();
    fireEvent.click(within(card).getByRole("button", { name: "Export" }));
    expect(onExport).toHaveBeenCalled();
  });

  it("trims by one second and respects the limits", () => {
    const { onRangeChange, onResetRange } = renderCard({
      range: { start: 0, end: 60 },
    });
    // At the start of the video and at the platform maximum.
    expect(
      (
        screen.getByRole("button", {
          name: "Start 1 second earlier",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "End 1 second later",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(
      screen.getByRole("button", { name: "Start 1 second later" }),
    );
    expect(onRangeChange).toHaveBeenCalledWith({ start: 1, end: 60 });

    // Differs from the AI's range → "Trimmed" + reset.
    expect(screen.getByText("Trimmed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset trim" }));
    expect(onResetRange).toHaveBeenCalled();
  });

  it("shows export progress with a cancel button", () => {
    const { onCancelExport } = renderCard({
      exportState: { status: "exporting", progress: 0.42 },
    });
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "42",
    );
    expect(screen.getByText("Exporting… 42%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
    expect(onCancelExport).toHaveBeenCalled();
  });

  it("disables preview/export without the video, or while another clip exports", () => {
    renderCard({ canPlay: false });
    expect(
      (screen.getByRole("button", { name: "Preview" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Export" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByText("Attach the video to preview and export"),
    ).toBeTruthy();
  });

  it("turns Preview into Stop while previewing", () => {
    const { onStop } = renderCard({ previewing: true, exportLocked: true });
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Export" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

describe("SuggestionsPanel", () => {
  it("lists the summary, titles, hooks and hashtags with copy actions", () => {
    const onCopy = vi.fn();
    render(
      <SuggestionsPanel
        onCopy={onCopy}
        result={{
          summary: "A cooking vlog.",
          contentType: "vlog",
          titles: [{ text: "I cooked pasta for 30 days", platform: "youtube" }],
          hooks: [
            { text: "Stop boiling pasta like this", style: "bold-claim" },
          ],
          hashtags: ["#pasta", "#cooking"],
          model: { id: "m", name: "Gemini 2.5 Flash" },
        }}
      />,
    );
    expect(screen.getByText("A cooking vlog.")).toBeTruthy();
    expect(screen.getByText("Analyzed with Gemini 2.5 Flash")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Copy “I cooked pasta for 30 days”" }),
    );
    expect(onCopy).toHaveBeenLastCalledWith("I cooked pasta for 30 days");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy “Stop boiling pasta like this”",
      }),
    );
    expect(onCopy).toHaveBeenLastCalledWith("Stop boiling pasta like this");
    fireEvent.click(screen.getByRole("button", { name: "Copy all" }));
    expect(onCopy).toHaveBeenLastCalledWith("#pasta #cooking");
  });
});

describe("AnalysisHistory", () => {
  it("opens and deletes past analyses", () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(
      <AnalysisHistory
        items={[
          {
            id: "va1",
            fileName: "vlog.mp4",
            durationSec: 125,
            frameCount: 20,
            modelId: "m",
            creditsCharged: 8,
            highlights: 5,
            topTitle: "30 days of pasta",
            createdAt: new Date().toISOString(),
          },
        ]}
        activeId="va1"
        onOpen={onOpen}
        onDelete={onDelete}
      />,
    );
    const open = screen.getByRole("button", {
      name: "Open the analysis of vlog.mp4",
    });
    expect(open.textContent).toContain("30 days of pasta");
    expect(open.textContent).toContain("02:05");
    expect(open.textContent).toContain("5 clips");
    expect(open.getAttribute("aria-current")).toBe("true");
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalledWith("va1");
    fireEvent.click(
      screen.getByRole("button", { name: "Delete the analysis of vlog.mp4" }),
    );
    expect(onDelete).toHaveBeenCalledWith("va1");
  });

  it("has an empty state", () => {
    render(<AnalysisHistory items={[]} onOpen={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Your analyses will appear here.")).toBeTruthy();
  });
});
