"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface LeaveGuardOptions {
  /** Guard the page (e.g. a video only exists in this tab's memory). */
  active: boolean;
  /**
   * The user accepted to leave: after the browser's refresh/close prompt
   * (runs on `pagehide`, while the page unloads — keep it synchronous) or
   * after confirming an in-app navigation.
   */
  onLeave: () => void;
}

export interface LeaveGuard {
  /** In-app destination waiting for confirmation (show your dialog). */
  pendingHref: string | null;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

/**
 * Warns before losing in-memory work:
 * - refresh / close / external links → the browser's own "Leave site?"
 *   prompt (`beforeunload`; browsers don't show custom text there);
 * - links inside the app → `pendingHref`, for a custom dialog that can
 *   explain what will be lost.
 * `onLeave` runs once the user has accepted either way.
 */
export function useLeaveGuard({
  active,
  onLeave,
}: LeaveGuardOptions): LeaveGuard {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const onLeaveRef = useRef(onLeave);
  onLeaveRef.current = onLeave;

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers need a (non-empty-check) returnValue to prompt.
      event.returnValue = "";
    };
    // Fires only once the page really goes away (prompt accepted).
    const onPageHide = () => onLeaveRef.current();

    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return; // new tab/window: this page stays
      }
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (
        (link.target && link.target !== "_self") ||
        link.hasAttribute("download")
      ) {
        return;
      }
      const url = new URL(link.href, window.location.href);
      // Other sites unload the page: the browser prompt covers them.
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return; // same page (anchors)
      }
      // Before Next.js' <Link> handler (capture on document).
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const confirmLeave = useCallback(() => {
    if (!pendingHref) return;
    onLeaveRef.current();
    setPendingHref(null);
    router.push(pendingHref);
  }, [pendingHref, router]);

  const cancelLeave = useCallback(() => setPendingHref(null), []);

  return { pendingHref, confirmLeave, cancelLeave };
}
