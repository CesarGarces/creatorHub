"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { useUiLabels } from "../lib/labels";

export interface ZoomableImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt"
> {
  src: string;
  /** Alternative text of the image. */
  alt: string;
  /** Largest zoom factor while pinching. */
  maxScale?: number;
  /** Classes of the frame around the image (e.g. `rounded-lg`). */
  containerClassName?: string;
  /** Called with the zoom factor whenever it changes (back to 1 on release). */
  onScaleChange?: (scale: number) => void;
  /** Called when the full-screen zoom layer opens (`true`) and closes. */
  onZoomChange?: (zooming: boolean) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the zoomed copy is, relative to the original image (origin top-left). */
interface Transform {
  scale: number;
  x: number;
  y: number;
}

/** The fingers (or cursor) and transform when the current gesture began. */
interface Gesture {
  base: Transform;
  mid: Point;
  distance: number;
}

const IDENTITY: Transform = { scale: 1, x: 0, y: 0 };
/** Duration of the spring back to the original position. */
export const ZOOM_RETURN_MS = 300;
const RETURN_EASE = "cubic-bezier(0.2, 0.9, 0.3, 1)";
/** Scale increase at which the blurred backdrop is fully visible. */
const BACKDROP_FULL_AT = 0.5;
/** Idle time that ends a Ctrl + wheel / trackpad pinch. */
const WHEEL_IDLE_MS = 180;

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const toPoints = (list: TouchList): Point[] =>
  Array.from(list)
    .slice(0, 2)
    .map((t) => ({ x: t.clientX, y: t.clientY }));

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Instagram-style pinch to zoom: pinching the image lifts a copy of it above
 * everything, which follows the fingers (scale and position) over the whole
 * screen while the page behind fades into a blur. Releasing the fingers
 * springs the image back into place.
 *
 * The page itself never zooms from a gesture that starts on the image
 * (`touch-action: pan-x pan-y` plus Safari's `gesture*` events), while
 * one-finger scrolling over it keeps working. On desktop a trackpad pinch /
 * Ctrl + wheel does the same.
 */
export function ZoomableImage({
  src,
  alt,
  maxScale = 4,
  className,
  containerClassName,
  onScaleChange,
  onZoomChange,
  style,
  ...imgProps
}: ZoomableImageProps) {
  const labels = useUiLabels().imageViewer;
  const hintId = React.useId();
  const frameRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const layerImgRef = React.useRef<HTMLImageElement>(null);
  const backdropRef = React.useRef<HTMLDivElement>(null);

  /** The original image's box while the zoom layer is shown. */
  const [layer, setLayer] = React.useState<Rect | null>(null);
  const layerRef = React.useRef<Rect | null>(null);
  const transform = React.useRef<Transform>(IDENTITY);
  const gesture = React.useRef<Gesture | null>(null);
  const touching = React.useRef(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const wheelTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Latest callbacks, read from the native listeners.
  const callbacks = React.useRef({ onScaleChange, onZoomChange });
  callbacks.current = { onScaleChange, onZoomChange };

  /** Writes the transform straight to the DOM: no React render per frame. */
  const paint = React.useCallback(() => {
    const t = transform.current;
    const img = layerImgRef.current;
    if (img) {
      img.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) scale(${t.scale})`;
    }
    const backdrop = backdropRef.current;
    if (backdrop) {
      backdrop.style.opacity = String(
        Math.min(1, (t.scale - 1) / BACKDROP_FULL_AT),
      );
    }
    frameRef.current?.setAttribute("data-zoom-scale", t.scale.toFixed(2));
  }, []);

  const setTransform = React.useCallback(
    (next: Transform) => {
      const previous = transform.current;
      transform.current = next;
      paint();
      if (next.scale !== previous.scale) {
        callbacks.current.onScaleChange?.(next.scale);
      }
    },
    [paint],
  );

  const setTransitions = (on: boolean) => {
    const duration = on ? ZOOM_RETURN_MS : 0;
    if (layerImgRef.current) {
      layerImgRef.current.style.transition = on
        ? `transform ${duration}ms ${RETURN_EASE}`
        : "none";
    }
    if (backdropRef.current) {
      backdropRef.current.style.transition = on
        ? `opacity ${duration}ms ease-out`
        : "none";
    }
  };

  /** Removes the zoom layer and shows the original image again. */
  const finish = React.useCallback(() => {
    clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
    gesture.current = null;
    if (!layerRef.current) return;
    layerRef.current = null;
    setLayer(null);
    setTransform(IDENTITY);
    callbacks.current.onZoomChange?.(false);
  }, [setTransform]);

  /** Lifts the image into the zoom layer (or grabs it again mid-return). */
  const open = (): boolean => {
    if (closeTimer.current) {
      // Caught while springing back: continue from where it is on screen.
      clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
      const img = layerImgRef.current;
      const matrix =
        img && typeof DOMMatrixReadOnly !== "undefined"
          ? new DOMMatrixReadOnly(getComputedStyle(img).transform)
          : null;
      setTransitions(false);
      if (matrix && matrix.a > 0) {
        transform.current = { scale: matrix.a, x: matrix.e, y: matrix.f };
      }
      paint();
      return true;
    }
    if (layerRef.current) return true;
    const img = imgRef.current;
    if (!img) return false;
    const r = img.getBoundingClientRect();
    const rect = { left: r.left, top: r.top, width: r.width, height: r.height };
    layerRef.current = rect;
    transform.current = IDENTITY;
    setLayer(rect);
    callbacks.current.onZoomChange?.(true);
    return true;
  };

  /** Releases the image: it springs back into place, the blur fades. */
  const release = React.useCallback(() => {
    gesture.current = null;
    if (!layerRef.current || closeTimer.current) return;
    if (prefersReducedMotion()) {
      finish();
      return;
    }
    setTransitions(true);
    setTransform(IDENTITY);
    closeTimer.current = setTimeout(finish, ZOOM_RETURN_MS + 20);
  }, [finish, setTransform]);

  /** Follows `points` (1 or 2 fingers / the cursor) from the gesture start. */
  const follow = (points: Point[], scaleBy?: number) => {
    const start = gesture.current;
    const rect = layerRef.current;
    if (!start || !rect || points.length === 0) return;
    const mid =
      points.length >= 2
        ? midpoint(points[0]!, points[1]!)
        : (points[0] as Point);
    const factor =
      scaleBy ??
      (points.length >= 2 && start.distance > 0
        ? distance(points[0]!, points[1]!) / start.distance
        : 1);
    const scale = Math.min(Math.max(start.base.scale * factor, 1), maxScale);
    // Keep the image point that was under the fingers under the fingers.
    const ux = (start.mid.x - rect.left - start.base.x) / start.base.scale;
    const uy = (start.mid.y - rect.top - start.base.y) / start.base.scale;
    setTransform({
      scale,
      x: mid.x - rect.left - scale * ux,
      y: mid.y - rect.top - scale * uy,
    });
  };

  const begin = (points: Point[]) => {
    gesture.current = {
      base: transform.current,
      mid:
        points.length >= 2
          ? midpoint(points[0]!, points[1]!)
          : (points[0] as Point),
      distance: points.length >= 2 ? distance(points[0]!, points[1]!) : 0,
    };
  };

  // Native listeners: they must be able to cancel the browser's own
  // scrolling / zooming (`passive: false`). Attached right after the commit
  // so a gesture that starts immediately is already handled.
  React.useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touching.current = true;
      const points = toPoints(e.targetTouches);
      if (points.length >= 2) {
        // Two fingers on the image: this is a pinch, not a scroll.
        if (e.cancelable) e.preventDefault();
        if (open()) {
          setTransitions(false);
          begin(points);
        }
      } else if (gesture.current) {
        begin(points);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!gesture.current) return;
      if (e.cancelable) e.preventDefault();
      follow(toPoints(e.targetTouches));
    };
    const onTouchEnd = (e: TouchEvent) => {
      touching.current = e.touches.length > 0;
      if (!gesture.current) return;
      const points = toPoints(e.targetTouches);
      // Lifting one finger keeps moving the image with the other one.
      if (points.length > 0) begin(points);
      else release();
    };

    const onWheel = (e: WheelEvent) => {
      // Trackpad pinch and Ctrl + wheel: zoom the image, not the page.
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!open()) return;
      const point = { x: e.clientX, y: e.clientY };
      begin([point]);
      follow([point], Math.exp(-e.deltaY * 0.01));
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(release, WHEEL_IDLE_MS);
    };

    // Safari: its own pinch events. On touch devices the touch handlers
    // above do the work; on a Mac trackpad these drive the zoom.
    type GestureEvent = Event & {
      scale: number;
      clientX: number;
      clientY: number;
    };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      if (touching.current) return;
      const g = e as GestureEvent;
      if (open()) {
        setTransitions(false);
        begin([{ x: g.clientX, y: g.clientY }]);
      }
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      if (touching.current || !gesture.current) return;
      const g = e as GestureEvent;
      follow([gesture.current.mid], g.scale);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      if (!touching.current) release();
    };

    const active = { passive: false } as const;
    el.addEventListener("touchstart", onTouchStart, active);
    el.addEventListener("touchmove", onTouchMove, active);
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("wheel", onWheel, active);
    el.addEventListener("gesturestart", onGestureStart, active);
    el.addEventListener("gesturechange", onGestureChange, active);
    el.addEventListener("gestureend", onGestureEnd, active);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      el.removeEventListener("gestureend", onGestureEnd);
    };
    // The handlers only read refs; `maxScale` is used through `follow`.
  }, [maxScale, release]);

  // Show the current transform as soon as the layer is in the DOM.
  React.useLayoutEffect(() => {
    if (layer) paint();
  }, [layer, paint]);

  // A new image, or unmounting, drops any zoom in progress.
  React.useEffect(() => finish, [src, finish]);
  React.useEffect(() => () => clearTimeout(wheelTimer.current), []);

  return (
    <div
      ref={frameRef}
      role="group"
      aria-label={labels.label}
      aria-describedby={hintId}
      title={labels.hint}
      data-zoom-scale="1.00"
      data-zooming={layer ? "true" : undefined}
      className={cn(
        "relative inline-flex max-w-full select-none",
        containerClassName,
      )}
      // One finger still scrolls; pinching never zooms the page.
      style={{ touchAction: "pan-x pan-y" }}
    >
      <img
        {...imgProps}
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className={cn("block", className)}
        // While zoomed, the lifted copy takes the image's place.
        style={{ ...style, opacity: layer ? 0 : style?.opacity }}
      />
      <span id={hintId} className="sr-only">
        {labels.hint}
      </span>
      {layer &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[100000]"
            aria-hidden="true"
            data-zoom-layer=""
          >
            <div
              ref={backdropRef}
              data-zoom-backdrop=""
              className="absolute inset-0 bg-black/60 backdrop-blur-xl"
              style={{ opacity: 0 }}
            />
            <img
              ref={layerImgRef}
              src={src}
              alt=""
              draggable={false}
              className="absolute max-h-none max-w-none object-contain shadow-2xl"
              style={{
                left: layer.left,
                top: layer.top,
                width: layer.width,
                height: layer.height,
                transformOrigin: "0 0",
                willChange: "transform",
              }}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
