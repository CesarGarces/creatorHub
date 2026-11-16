"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query. Layout-only: used where a breakpoint
 * changes *how* something is shown (docked panel vs. overlay), never what
 * data is loaded. Returns `false` on the server and where matchMedia is
 * unavailable, i.e. mobile-first.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) {
        return () => {};
      }
      const mql = window.matchMedia(query);
      mql.addEventListener?.("change", onChange);
      return () => mql.removeEventListener?.("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" && !!window.matchMedia
        ? window.matchMedia(query).matches
        : false,
    () => false,
  );
}

/** Below Tailwind's `sm` breakpoint: phones. */
export const PHONE_QUERY = "(max-width: 639.98px)";

/** Tailwind's `lg` breakpoint: the docked, multi-panel desktop layout. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
