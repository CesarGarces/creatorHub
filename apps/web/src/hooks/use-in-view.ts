"use client";

import { useEffect, useState, type RefCallback } from "react";

interface InViewOptions {
  /** Grows the viewport, e.g. "200px 0px" = start 200px before it shows. */
  rootMargin?: string;
}

/**
 * `true` once the element has come near the viewport, and from then on
 * (it never goes back to `false`). Used to mount heavy content — code and
 * data — only when it is about to be seen.
 *
 * Without IntersectionObserver (old browsers, jsdom) it is `true` at once.
 */
export function useInView<T extends Element>({
  rootMargin = "0px",
}: InViewOptions = {}): [RefCallback<T>, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView || !node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, inView, rootMargin]);

  return [setNode, inView];
}
