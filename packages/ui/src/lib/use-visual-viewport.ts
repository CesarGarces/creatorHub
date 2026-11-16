"use client";

import { useEffect } from "react";

/**
 * Publishes the *visual* viewport as CSS variables on `<html>` so layouts can
 * follow the on-screen keyboard:
 *
 * - `--app-vvh`      visible height in px (shrinks while the keyboard is open)
 * - `--app-vv-top`   how far the visual viewport is scrolled/panned (iOS)
 * - `--app-keyboard` estimated keyboard height in px (0 when closed)
 *
 * Android/Chromium already resizes the layout viewport when the page opts in
 * with `interactive-widget=resizes-content`; iOS Safari only moves the visual
 * viewport, so fixed panels sized with these variables stay above the
 * keyboard on both. Consumers should always provide a fallback, e.g.
 * `h-[var(--app-vvh,100dvh)]`.
 *
 * Layout-only: it reads `window.visualViewport` and never touches app state.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = vv ? vv.height : window.innerHeight;
        const top = vv ? vv.offsetTop : 0;
        const keyboard = Math.max(0, window.innerHeight - height - top);
        root.style.setProperty("--app-vvh", `${Math.round(height)}px`);
        root.style.setProperty("--app-vv-top", `${Math.round(top)}px`);
        root.style.setProperty("--app-keyboard", `${Math.round(keyboard)}px`);
      });
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--app-vvh");
      root.style.removeProperty("--app-vv-top");
      root.style.removeProperty("--app-keyboard");
    };
  }, []);
}

/** Drop-in component form of {@link useVisualViewport} for server layouts. */
export function VisualViewportObserver(): null {
  useVisualViewport();
  return null;
}
