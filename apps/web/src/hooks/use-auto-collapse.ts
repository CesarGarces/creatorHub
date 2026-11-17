"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Idle time before a floating control tucks itself away. */
export const AUTO_COLLAPSE_MS = 5000;

export interface AutoCollapse {
  collapsed: boolean;
  /** Show the full control again and restart the idle timer. */
  expand: () => void;
  /** Pointer hover / keyboard focus: keep it expanded while held. */
  hold: (source: "hover" | "focus") => void;
  /** The hover/focus ended: collapse again after the idle time. */
  release: (source: "hover" | "focus") => void;
}

/**
 * Auto-collapse for floating controls (the assistant launcher): expanded on
 * mount, collapsed after `delay` ms without interaction or as soon as
 * anything on the page scrolls (captured, so scrolling inside `<main>`
 * counts). Hover and keyboard focus keep it expanded.
 */
export function useAutoCollapse(
  delay = AUTO_COLLAPSE_MS,
  enabled = true,
): AutoCollapse {
  const [collapsed, setCollapsed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef({ hover: false, focus: false });

  const isHeld = () => held.current.hover || held.current.focus;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const schedule = useCallback(() => {
    clear();
    if (!enabled || isHeld()) return;
    timer.current = setTimeout(() => setCollapsed(true), delay);
  }, [delay, enabled]);

  const expand = useCallback(() => {
    setCollapsed(false);
    schedule();
  }, [schedule]);

  const hold = useCallback((source: "hover" | "focus") => {
    held.current[source] = true;
    clear();
    setCollapsed(false);
  }, []);

  const release = useCallback(
    (source: "hover" | "focus") => {
      held.current[source] = false;
      schedule();
    },
    [schedule],
  );

  useEffect(() => {
    if (!enabled) {
      clear();
      return;
    }
    schedule();
    const onScroll = () => {
      if (isHeld()) return;
      clear();
      setCollapsed(true);
    };
    window.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      clear();
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [enabled, schedule]);

  return { collapsed, expand, hold, release };
}
