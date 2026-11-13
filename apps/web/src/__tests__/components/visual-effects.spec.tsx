import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import BorderGlow from "@/components/BorderGlow";
import { LiquidEtherBackground } from "@/components/animations";

const RECT = {
  left: 0,
  top: 0,
  width: 200,
  height: 100,
  right: 200,
  bottom: 100,
  x: 0,
  y: 0,
};

describe("BorderGlow", () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      ...RECT,
      toJSON: () => RECT,
    } as DOMRect);
  });
  afterEach(() => vi.restoreAllMocks());

  function renderGlow(props: Partial<Parameters<typeof BorderGlow>[0]> = {}) {
    const { container } = render(
      <BorderGlow {...props}>
        <p>card content</p>
      </BorderGlow>,
    );
    const card = container.firstElementChild as HTMLElement;
    const glow = card.querySelector("span.pointer-events-none") as HTMLElement;
    return { card, glow };
  }

  it("renders its children with the configured surface", () => {
    const { card } = renderGlow({
      backgroundColor: "rgb(1, 2, 3)",
      borderRadius: 12,
    });

    expect(screen.getByText("card content")).toBeTruthy();
    expect(card.style.background).toBe("rgb(1, 2, 3)");
    expect(card.style.borderRadius).toBe("12px");
  });

  it("keeps the glow hidden until hovered", () => {
    const { glow } = renderGlow();
    expect(Number(glow.style.opacity)).toBe(0);
  });

  it("lights up when the pointer is near an edge", () => {
    const { card, glow } = renderGlow();

    fireEvent.pointerEnter(card);
    fireEvent.pointerMove(card, { clientX: 199, clientY: 50 });

    expect(Number(glow.style.opacity)).toBeGreaterThan(0.9);
  });

  it("stays dark when the pointer is at the center", () => {
    const { card, glow } = renderGlow();

    fireEvent.pointerEnter(card);
    fireEvent.pointerMove(card, { clientX: 100, clientY: 50 });

    expect(Number(glow.style.opacity)).toBe(0);
  });

  it("fades out when the pointer leaves", () => {
    const { card, glow } = renderGlow();

    fireEvent.pointerEnter(card);
    fireEvent.pointerMove(card, { clientX: 199, clientY: 50 });
    fireEvent.pointerLeave(card);

    expect(Number(glow.style.opacity)).toBe(0);
  });

  it("points the glow cone toward the cursor", () => {
    const { card } = renderGlow();
    const border = card.querySelector("div") as HTMLElement;

    fireEvent.pointerEnter(card);
    // Angles are measured clockwise from the top edge.
    fireEvent.pointerMove(card, { clientX: 200, clientY: 50 }); // right edge
    expect(border.style.maskImage).toContain("from 90.000deg");

    fireEvent.pointerMove(card, { clientX: 100, clientY: 100 }); // bottom edge
    expect(border.style.maskImage).toContain("from 180.000deg");
  });

  it("plays an intro sweep when animated", () => {
    const { glow } = renderGlow({ animated: true });
    // Visible state uses the quick fade-in transition.
    expect(glow.style.transition).toBe("opacity 0.25s ease-out");
  });
});

describe("LiquidEtherBackground", () => {
  let frames: FrameRequestCallback[];
  const observers: Array<{
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  beforeEach(() => {
    frames = [];
    observers.length = 0;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => frames.push(cb)),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal(
      "ResizeObserver",
      vi.fn(function (this: (typeof observers)[number]) {
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function fakeContext() {
    return {
      scale: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  function renderInContainer() {
    return render(
      <div style={{ position: "relative" }}>
        <LiquidEtherBackground />
      </div>,
    );
  }

  it("renders a non-interactive canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { container } = renderInContainer();

    const canvas = container.querySelector("canvas")!;
    expect(canvas.className).toContain("pointer-events-none");
  });

  it("does nothing when 2D canvas is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    renderInContainer();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("draws 40 particles per frame and keeps animating", () => {
    const ctx = fakeContext();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as never,
    );
    renderInContainer();

    expect(frames).toHaveLength(1);
    frames[0]!(0);

    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
    expect(ctx.arc).toHaveBeenCalledTimes(40);
    expect(frames).toHaveLength(2); // scheduled the next frame
  });

  it("stops the animation and resize observer on unmount", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      fakeContext() as never,
    );
    const { unmount } = renderInContainer();

    expect(observers[0]!.observe).toHaveBeenCalled();
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(observers[0]!.disconnect).toHaveBeenCalled();
  });
});
