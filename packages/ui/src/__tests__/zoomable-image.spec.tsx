import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { UiLabelsProvider, ZoomableImage } from "../index";
import { ZOOM_RETURN_MS } from "../components/zoomable-image";

// jsdom has no layout: the image sits at (0, 0), 400×300.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 300,
    right: 400,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const viewer = () => screen.getByRole("group", { name: "Image viewer" });
const scale = () => viewer().getAttribute("data-zoom-scale");
const original = () =>
  screen.getByRole("img", { name: "A thumbnail" }) as HTMLImageElement;
const layer = () => document.querySelector<HTMLElement>("[data-zoom-layer]");
const layerImg = () => layer()?.querySelector("img") as HTMLImageElement;
const backdrop = () =>
  document.querySelector<HTMLElement>("[data-zoom-backdrop]")!;

function renderViewer(
  props: Partial<Parameters<typeof ZoomableImage>[0]> = {},
) {
  return render(<ZoomableImage src="/a.png" alt="A thumbnail" {...props} />);
}

type Pts = [number, number][];

/** Dispatches a touch event on the viewer; `fingers` are on the image. */
function touch(type: string, fingers: Pts, onScreen: Pts = fingers) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = (points: Pts) =>
    points.map(([clientX, clientY], identifier) => ({
      identifier,
      clientX,
      clientY,
    }));
  Object.defineProperty(event, "targetTouches", { value: list(fingers) });
  Object.defineProperty(event, "touches", { value: list(onScreen) });
  act(() => {
    viewer().dispatchEvent(event);
  });
  return event;
}

function wheel(init: WheelEventInit) {
  const event = new WheelEvent("wheel", { cancelable: true, ...init });
  act(() => {
    viewer().dispatchEvent(event);
  });
  return event;
}

describe("ZoomableImage", () => {
  it("renders the image alone: no buttons, scrolling allowed, no page zoom", () => {
    renderViewer();
    expect(scale()).toBe("1.00");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // One finger scrolls; pinch-zoom is not in the list → the page never zooms.
    expect(viewer().style.touchAction).toBe("pan-x pan-y");
    expect(layer()).toBeNull();
  });

  it("pinching lifts the image over a blurred page and follows the fingers", () => {
    const onZoomChange = vi.fn();
    const onScaleChange = vi.fn();
    renderViewer({ onZoomChange, onScaleChange });

    const start = touch("touchstart", [
      [150, 150],
      [250, 150],
    ]);
    expect(start.defaultPrevented).toBe(true);
    expect(layer()).not.toBeNull();
    expect(layer()!.parentElement).toBe(document.body);
    expect(layerImg().style.width).toBe("400px");
    expect(viewer().getAttribute("data-zooming")).toBe("true");
    expect(original().style.opacity).toBe("0");
    expect(onZoomChange).toHaveBeenLastCalledWith(true);

    // Fingers 100px → 200px apart around (200, 150): 2×, that point stays put.
    const move = touch("touchmove", [
      [100, 150],
      [300, 150],
    ]);
    expect(move.defaultPrevented).toBe(true);
    expect(scale()).toBe("2.00");
    expect(onScaleChange).toHaveBeenLastCalledWith(2);
    expect(layerImg().style.transform).toBe(
      "translate3d(-200px, -150px, 0) scale(2)",
    );
    expect(backdrop().style.opacity).toBe("1");

    // Moving both fingers moves the image with them.
    touch("touchmove", [
      [150, 200],
      [350, 200],
    ]);
    expect(layerImg().style.transform).toBe(
      "translate3d(-150px, -100px, 0) scale(2)",
    );
  });

  it("releasing springs the image back, then the layer goes away", () => {
    vi.useFakeTimers();
    const onZoomChange = vi.fn();
    const onScaleChange = vi.fn();
    renderViewer({ onZoomChange, onScaleChange });
    touch("touchstart", [
      [150, 150],
      [250, 150],
    ]);
    touch("touchmove", [
      [100, 150],
      [300, 150],
    ]);

    touch("touchend", [], []);
    // Animating back to the original place; the blur fades out.
    expect(layerImg().style.transform).toBe(
      "translate3d(0px, 0px, 0) scale(1)",
    );
    expect(layerImg().style.transition).toContain("transform");
    expect(backdrop().style.opacity).toBe("0");
    expect(onScaleChange).toHaveBeenLastCalledWith(1);
    expect(layer()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(ZOOM_RETURN_MS + 50);
    });
    expect(layer()).toBeNull();
    expect(original().style.opacity).toBe("");
    expect(viewer().hasAttribute("data-zooming")).toBe(false);
    expect(onZoomChange).toHaveBeenLastCalledWith(false);
  });

  it("lifting one finger keeps moving the image with the other", () => {
    renderViewer();
    touch("touchstart", [
      [150, 150],
      [250, 150],
    ]);
    touch("touchmove", [
      [100, 150],
      [300, 150],
    ]);
    touch("touchend", [[100, 150]]);
    touch("touchmove", [[130, 190]]);
    expect(scale()).toBe("2.00");
    expect(layerImg().style.transform).toBe(
      "translate3d(-170px, -110px, 0) scale(2)",
    );
  });

  it("one finger scrolls the page and does not zoom", () => {
    renderViewer();
    const start = touch("touchstart", [[200, 150]]);
    const move = touch("touchmove", [[200, 50]]);
    expect(start.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
    expect(layer()).toBeNull();
  });

  it("keeps the zoom between 1× and maxScale", () => {
    renderViewer({ maxScale: 3 });
    touch("touchstart", [
      [190, 150],
      [210, 150],
    ]);
    touch("touchmove", [
      [0, 150],
      [400, 150],
    ]);
    expect(scale()).toBe("3.00");
    touch("touchmove", [
      [199, 150],
      [201, 150],
    ]);
    expect(scale()).toBe("1.00");
  });

  it("a trackpad pinch / Ctrl + wheel zooms the image, not the page", () => {
    vi.useFakeTimers();
    renderViewer();
    const zoom = wheel({
      deltaY: -50,
      ctrlKey: true,
      clientX: 200,
      clientY: 150,
    });
    expect(zoom.defaultPrevented).toBe(true);
    expect(layer()).not.toBeNull();
    expect(Number(scale())).toBeGreaterThan(1);

    // The gesture ends when the wheel stops.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(layer()).toBeNull();
    expect(scale()).toBe("1.00");

    const plain = wheel({ deltaY: 100 });
    expect(plain.defaultPrevented).toBe(false);
  });

  it("skips the animation with reduced motion", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
    );
    renderViewer();
    touch("touchstart", [
      [150, 150],
      [250, 150],
    ]);
    touch("touchend", [], []);
    expect(layer()).toBeNull();
  });

  it("drops the zoom when the image changes", () => {
    const { rerender } = renderViewer();
    touch("touchstart", [
      [150, 150],
      [250, 150],
    ]);
    expect(layer()).not.toBeNull();
    rerender(<ZoomableImage src="/b.png" alt="A thumbnail" />);
    expect(layer()).toBeNull();
    expect(scale()).toBe("1.00");
  });

  it("uses the localized labels", () => {
    render(
      <UiLabelsProvider
        labels={{
          imageViewer: {
            label: "Visor de imagen",
            hint: "Pellizca la imagen para ampliarla.",
          },
        }}
      >
        <ZoomableImage src="/a.png" alt="Miniatura" />
      </UiLabelsProvider>,
    );
    const group = screen.getByRole("group", { name: "Visor de imagen" });
    expect(group.getAttribute("title")).toBe(
      "Pellizca la imagen para ampliarla.",
    );
  });
});
