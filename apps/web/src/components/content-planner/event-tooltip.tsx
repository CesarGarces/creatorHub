"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@creator-hub/ui";
import { useI18n } from "@/i18n/i18n-provider";
import type { ContentEvent } from "@/lib/content-planner/types";
import { eventStyle } from "./event-type-meta";
import { useTypeLabel } from "./use-type-label";
import { useToolsStore } from "@/store/tools.store";
import { useToolText } from "@/i18n/use-tool-text";

/** Hover delay, so sweeping the mouse across the calendar doesn't flicker. */
export const TOOLTIP_DELAY_MS = 300;
const WIDTH = 288; // px (w-72)
const GAP = 8;

interface TooltipState {
  event: ContentEvent;
  anchor: DOMRect;
}

/**
 * Hover/focus card for calendar sessions, showing their description (notes)
 * and details. Rendered in a portal so the calendar's scroll containers
 * can't clip it.
 *
 *   const tooltip = useEventTooltip();
 *   <button {...tooltip.triggerProps(event)} />
 *   {tooltip.node}
 */
export function useEventTooltip() {
  const [state, setState] = useState<TooltipState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const hide = useCallback(() => {
    clearTimer();
    setState(null);
  }, []);

  const show = useCallback(
    (event: ContentEvent, element: HTMLElement, delay: number) => {
      clearTimer();
      const open = () =>
        setState({ event, anchor: element.getBoundingClientRect() });
      if (delay === 0) open();
      else timer.current = setTimeout(open, delay);
    },
    [],
  );

  // The anchor position goes stale when anything scrolls: just close.
  useEffect(() => {
    if (!state) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [state, hide]);

  useEffect(() => clearTimer, []);

  const triggerProps = (event: ContentEvent) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) =>
      show(event, e.currentTarget, TOOLTIP_DELAY_MS),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent<HTMLElement>) =>
      show(event, e.currentTarget, 0),
    onBlur: hide,
    "aria-describedby": state?.event.id === event.id ? tooltipId : undefined,
  });

  const node = state ? (
    <EventTooltip id={tooltipId} event={state.event} anchor={state.anchor} />
  ) : null;

  return { triggerProps, hide, node };
}

function EventTooltip({
  id,
  event,
  anchor,
}: {
  id: string;
  event: ContentEvent;
  anchor: DOMRect;
}) {
  const { t, formatDate } = useI18n();
  const typeLabel = useTypeLabel();
  const tools = useToolsStore((s) => s.tools);
  const { toolName: localizedToolName } = useToolText();
  const toolName = (id: string) => {
    const tool = tools.find((x) => x.id === id);
    return tool ? localizedToolName(tool) : id;
  };
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => place(anchor, 0));

  // Measure the real height to keep the card inside the viewport.
  useLayoutEffect(() => {
    setPosition(place(anchor, ref.current?.offsetHeight ?? 0));
  }, [anchor]);

  const time = (iso: string) =>
    formatDate(iso, { hour: "numeric", minute: "2-digit" });
  const style = eventStyle(event);
  const description = event.notes?.trim();

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className="pointer-events-none fixed z-[1000] w-72 rounded-lg border border-border bg-surface-elevated p-3 text-left shadow-2xl animate-fade-in"
      style={{ top: position.top, left: position.left }}
    >
      <p className="text-sm font-semibold text-text break-words">
        {event.title}
      </p>
      <p className="mt-0.5 text-xs text-text-muted">
        {formatDate(event.startAt, {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}{" "}
        · {time(event.startAt)} – {time(event.endAt)}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-muted">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
        {typeLabel(event)} · {t(`contentPlanner.statuses.${event.status}`)}
      </p>
      {event.project && (
        <p className="mt-0.5 truncate text-xs text-text-dim">
          {event.project.title}
        </p>
      )}
      {event.toolAction && (
        <p className="mt-1.5 text-xs text-primary">
          {t("contentPlanner.ai.toolChip", {
            tool: toolName(event.toolAction.toolId),
            intention: event.toolAction.intention,
          })}
        </p>
      )}
      <div className="mt-2 border-t border-border pt-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-text-dim">
          {t("contentPlanner.tooltip.description")}
        </p>
        {description ? (
          <p className="mt-0.5 line-clamp-[10] whitespace-pre-line break-words text-xs text-text">
            {description}
          </p>
        ) : (
          <p className="mt-0.5 text-xs italic text-text-dim">
            {t("contentPlanner.tooltip.noDescription")}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Right of the anchor (left if it doesn't fit), clamped to the viewport. */
export function place(
  anchor: Pick<DOMRect, "top" | "left" | "right">,
  height: number,
  viewport = { width: window.innerWidth, height: window.innerHeight },
): { top: number; left: number } {
  const fitsRight = anchor.right + GAP + WIDTH <= viewport.width - GAP;
  const left = fitsRight
    ? anchor.right + GAP
    : Math.max(GAP, anchor.left - GAP - WIDTH);
  const top = Math.min(
    Math.max(GAP, anchor.top),
    Math.max(GAP, viewport.height - height - GAP),
  );
  return { top, left };
}
