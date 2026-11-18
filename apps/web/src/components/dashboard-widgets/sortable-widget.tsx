"use client";

import { memo, useMemo, type CSSProperties } from "react";
import {
  defaultAnimateLayoutChanges,
  useSortable,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Minus } from "lucide-react";
import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { cn } from "@creator-hub/ui";
import { useInView } from "@/hooks/use-in-view";
import { useI18n } from "@/i18n/i18n-provider";
import { spanClass, widgetMeta } from "@/lib/dashboard-widgets/catalog";
import { NO_WIDGET_DRAG } from "@/lib/dashboard-widgets/drag";
import { WIDGET_COMPONENTS } from "./widget-loader";
import { WidgetSkeleton } from "./widget-skeleton";

export interface SortableWidgetProps {
  id: DashboardWidgetId;
  /** Place in the grid: varies the wobble so widgets don't move in sync. */
  index: number;
  /** Rearranging: widgets wobble, their content is inert, badges show. */
  editing: boolean;
  /**
   * The layout is the user's: the widget may load. Until then (and until
   * it nears the viewport) its placeholder holds the space.
   */
  ready: boolean;
  onHide: (id: DashboardWidgetId) => void;
}

/** Every widget animates when the others reflow (not only the dragged one). */
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

/** Alternating direction and phase, like icons on a phone's home screen. */
function jiggleStyle(index: number): CSSProperties {
  return {
    animationDelay: `${-(index % 4) * 0.075}s`,
    animationDirection: index % 2 ? "reverse" : "normal",
  };
}

/**
 * One cell of the dashboard grid.
 *
 * - **Lazy:** the widget's code and data load when the layout is known and
 *   the cell comes within 200px of the viewport; a same-size placeholder
 *   holds the space until then.
 * - **Press and hold** anywhere on it (~0.4 s) to pick it up — the grid
 *   switches to rearranging. While rearranging, the widget wobbles, its
 *   content can't be used (`inert`), a "−" badge hides it, and a grip
 *   button moves it with the keyboard (Space/Enter, arrows, Space/Enter).
 */
export const SortableWidget = memo(function SortableWidget({
  id,
  index,
  editing,
  ready,
  onHide,
}: SortableWidgetProps) {
  const { t } = useI18n();
  const meta = widgetMeta(id);
  const name = t(meta.nameKey);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, animateLayoutChanges, disabled: !ready });
  const [viewRef, inView] = useInView<HTMLDivElement>({
    rootMargin: "200px 0px",
  });

  // Same element while nothing changes: re-renders during a drag (every
  // pointer move) skip the widget's whole subtree.
  const Widget = WIDGET_COMPONENTS[id];
  const body = useMemo(
    () => (ready && inView ? <Widget /> : <WidgetSkeleton id={id} />),
    [ready, inView, Widget, id],
  );

  return (
    <div
      ref={setNodeRef}
      data-widget-id={id}
      data-editing={editing || undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        // `group/widget` + data-editing: widget parts react with CSS only.
        "group/widget relative min-w-0",
        spanClass(meta.span),
        // Long presses lift the widget: no callout or text selection on touch.
        "[-webkit-touch-callout:none] pointer-coarse:select-none",
      )}
      {...listeners}
    >
      {isDragging && (
        // The slot the widget will drop into.
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
        />
      )}
      <div
        data-widget-wobble
        style={editing && !isDragging ? jiggleStyle(index) : undefined}
        className={cn(
          "relative h-full",
          meta.span === "full"
            ? "[--widget-jiggle-angle:0.5deg] lg:[--widget-jiggle-angle:0.22deg]"
            : "[--widget-jiggle-angle:0.5deg] lg:[--widget-jiggle-angle:0.4deg]",
          editing &&
            !isDragging &&
            "animate-widget-jiggle will-change-transform",
          editing && "cursor-grab",
          isDragging && "invisible",
        )}
      >
        <div
          ref={viewRef}
          data-widget-body
          inert={editing}
          className={cn("h-full", editing && "pointer-events-none select-none")}
        >
          {body}
        </div>
      </div>
      {/* Outside the wobbling layer: the controls hold still, easy to hit. */}
      {editing && (
        <div className={cn(isDragging && "invisible")}>
          <button
            type="button"
            onClick={() => onHide(id)}
            aria-label={t("dashboard.layout.hide", { name })}
            {...NO_WIDGET_DRAG}
            className={cn(
              "absolute -left-2.5 -top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:-left-4 pointer-coarse:-top-4",
              "animate-widget-pop text-text",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              // The visible dot stays small; the touch target is 44px.
              "before:absolute before:left-1/2 before:top-1/2 before:h-7 before:w-7 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-border before:bg-surface-elevated before:shadow-md before:content-[''] hover:before:bg-error-solid",
            )}
          >
            <Minus className="relative h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            aria-label={t("dashboard.layout.move", { name })}
            className={cn(
              "absolute -right-2.5 -top-2.5 z-10 flex h-7 w-7 touch-none items-center justify-center rounded-full pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:-right-4 pointer-coarse:-top-4",
              "animate-widget-pop cursor-grab text-text-muted active:cursor-grabbing",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "before:absolute before:left-1/2 before:top-1/2 before:h-7 before:w-7 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-border before:bg-surface-elevated before:shadow-md before:content-['']",
            )}
          >
            <GripVertical className="relative h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
});
