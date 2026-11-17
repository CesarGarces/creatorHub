"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import { AUTO_COLLAPSE_MS, useAutoCollapse } from "@/hooks/use-auto-collapse";

/** The "Do you need help?" hint appears after this delay (while expanded). */
export const LAUNCHER_TOOLTIP_DELAY_MS = 1500;
/** …and goes away for good after this long. */
export const LAUNCHER_TOOLTIP_LIFETIME_MS = 20_000;

export interface ChatLauncherProps {
  /** Opens the assistant panel. */
  onOpen: () => void;
  /** Idle time before collapsing (ms). */
  collapseAfterMs?: number;
  /** Never show the "Do you need help?" hint (e.g. the chat was opened before). */
  hideTooltip?: boolean;
}

/**
 * Floating assistant button (bottom-right). Expanded on load, then after a
 * few idle seconds — or as soon as the page scrolls — it tucks into a small
 * tab against the screen edge so it doesn't sit on top of content. Hover,
 * keyboard focus or a first tap (touch) bring the full button back.
 *
 * No layout shift: the fixed slot (the <button>) never changes size or
 * position; only the visual pill inside it moves (translate, radius,
 * colours). The slot ignores the pointer, so only the visible pill/tab
 * catches taps and the content beside it stays clickable.
 */
export function ChatLauncher({
  onOpen,
  collapseAfterMs = AUTO_COLLAPSE_MS,
  hideTooltip = false,
}: ChatLauncherProps) {
  const { t } = useI18n();
  const { collapsed, expand, hold, release } = useAutoCollapse(collapseAfterMs);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipDone, setTooltipDone] = useState(hideTooltip);

  // A touch on the collapsed tab only expands it (a second tap opens the
  // chat): edge tabs are easy to hit by accident while swiping.
  const collapsedRef = useRef(collapsed);
  collapsedRef.current = collapsed;
  const expandOnly = useRef(false);

  useEffect(() => {
    if (tooltipDone || collapsed) {
      setTooltipVisible(false);
      return;
    }
    const show = setTimeout(
      () => setTooltipVisible(true),
      LAUNCHER_TOOLTIP_DELAY_MS,
    );
    const done = setTimeout(() => {
      setTooltipVisible(false);
      setTooltipDone(true);
    }, LAUNCHER_TOOLTIP_LIFETIME_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(done);
    };
  }, [collapsed, tooltipDone]);

  // Once the launcher has tucked away, the hint has done its job.
  useEffect(() => {
    if (collapsed && tooltipVisible) setTooltipDone(true);
  }, [collapsed, tooltipVisible]);

  return (
    <div
      data-testid="chat-launcher"
      className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-0 z-[100] sm:bottom-6 max-sm:group-has-[[data-composer]]/shell:bottom-[calc(9rem+env(safe-area-inset-bottom))] sm:max-lg:group-has-[[data-composer]]/shell:bottom-[6rem]"
    >
      {tooltipVisible && !collapsed && (
        <div
          role="tooltip"
          className={cn(
            "absolute bottom-full right-4 mb-3 sm:right-6",
            "w-max max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface px-4 py-2.5",
            "text-sm text-text shadow-lg shadow-black/5",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
          )}
        >
          <span className="font-medium">{t("chat.tooltip")}</span>
          <div className="absolute -bottom-1.5 right-6 h-2.5 w-2.5 rotate-45 border-b border-r border-border bg-surface" />
        </div>
      )}

      <button
        type="button"
        aria-label={t("chat.openChat")}
        aria-expanded={false}
        data-state={collapsed ? "collapsed" : "expanded"}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hold("hover");
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") release("hover");
        }}
        onPointerDown={(e) => {
          expandOnly.current =
            collapsedRef.current && e.pointerType !== "mouse";
        }}
        onFocus={() => hold("focus")}
        onBlur={() => release("focus")}
        onClick={() => {
          if (expandOnly.current) {
            expandOnly.current = false;
            expand();
            return;
          }
          setTooltipDone(true);
          onOpen();
        }}
        // Fixed-size slot: 56px button + its gap to the edge (16px phones,
        // 24px from sm). It never moves or resizes.
        className="group pointer-events-none relative block h-14 w-[4.5rem] focus-visible:outline-none sm:w-20"
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-auto absolute right-4 top-0 flex h-14 w-14 items-center justify-center border sm:right-6",
            "transition-[translate,scale,border-radius,background-color,border-color,color,box-shadow] duration-300 ease-out motion-reduce:transition-none",
            "group-focus-visible:ring-2 group-focus-visible:ring-primary group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg",
            collapsed
              ? // A tab tucked 12px past the edge: 44px visible, square on the edge side.
                "translate-x-7 rounded-l-2xl rounded-r-none border-primary/40 bg-surface-elevated text-primary shadow-md shadow-black/30 sm:translate-x-9"
              : "translate-x-0 rounded-[1.75rem] border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:scale-105 hover:shadow-xl hover:shadow-primary/30 active:scale-95",
          )}
        >
          <MessageCircle
            className={cn(
              "h-6 w-6 transition-[translate,scale] duration-300 ease-out motion-reduce:transition-none",
              // Centred in the visible 44px of the tab.
              collapsed
                ? "-translate-x-1.5 scale-90"
                : "translate-x-0 scale-100",
            )}
          />
          {!collapsed && (
            <span className="absolute inset-0 rounded-[inherit] bg-primary/20 animate-ping motion-reduce:animate-none" />
          )}
        </span>
      </button>
    </div>
  );
}
