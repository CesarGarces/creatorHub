"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  type SortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import type { DashboardWidgetId } from "@creator-hub/shared-types";
import { EmptyState, cn } from "@creator-hub/ui";
import { useAuthStore } from "@/store/auth.store";
import { useDashboardLayoutStore } from "@/store/dashboard-layout.store";
import { useI18n } from "@/i18n/i18n-provider";
import { widgetMeta } from "@/lib/dashboard-widgets/catalog";
import {
  EDIT_MOUSE_DISTANCE_PX,
  EDIT_TOUCH_DELAY_MS,
  LONG_PRESS_MS,
  LONG_PRESS_TOLERANCE_PX,
} from "@/lib/dashboard-widgets/drag";
import { visibleWidgetIds } from "@/lib/dashboard-widgets/layout";
import {
  WidgetKeyboardSensor,
  WidgetMouseSensor,
  WidgetTouchSensor,
} from "./sensors";
import { SortableWidget } from "./sortable-widget";
import { ADD_WIDGETS_HREF, WidgetEditBar } from "./widget-edit-bar";

export interface DashboardWidgetsProps {
  /** Rearranging mode (wobbling widgets, "−" badges, edit bar). */
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  className?: string;
}

/**
 * The order changes live while dragging (the grid reflows, neighbours
 * glide), so no sorting transforms are needed — and widgets of different
 * sizes never overlap.
 */
const reflowStrategy: SortingStrategy = () => null;

/**
 * Keyboard moves are by position in the order, not by geometry: ← ↑ one
 * place earlier, → ↓ one place later — one swap per key press, whatever the
 * widget sizes (and predictable with a screen reader).
 */
const KEY_STEPS: Record<string, -1 | 1> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
};

/**
 * After a swap, the drag must move this far before the next one. A swap
 * reflows the grid, which can put another widget under a pointer that
 * hasn't moved; without this, widgets of different sizes could keep
 * swapping back and forth on their own.
 */
const SWAP_DISTANCE_PX = 16;

/**
 * Drop: the lifted copy glides to the slot with a slight overshoot and
 * lands with a bounce (`widget-land`); the real widget appears under it.
 */
const dropAnimation: DropAnimation = {
  duration: 360,
  easing: "cubic-bezier(0.34, 1.36, 0.64, 1)",
  sideEffects: (args) => {
    args.dragOverlay.node
      .querySelector("[data-widget-lift]")
      ?.setAttribute("data-landing", "");
    return defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0" } },
    })(args);
  },
};

/** A static copy of a widget (what the finger carries): no second mount. */
function cloneForOverlay(body: Element): HTMLElement {
  const clone = body.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-widget-body");
  // Unique ids stay unique (labels, aria references).
  clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  return clone;
}

function WidgetSnapshot({ node }: { node: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.replaceChildren(node);
  }, [node]);
  return (
    <div
      ref={ref}
      data-widget-lift
      // Same CSS context as a cell while rearranging (e.g. header padding).
      data-editing=""
      aria-hidden="true"
      inert
      className="group/widget h-full cursor-grabbing rounded-xl bg-bg shadow-2xl shadow-black/50 ring-1 ring-primary/30 animate-widget-lift data-[landing]:animate-widget-land"
    />
  );
}

/**
 * The dashboard's widgets, in the user's order (ARCHITECTURE.md §2f).
 *
 * Press and hold a widget (~0.4 s, mouse or finger) to pick it up: the
 * dashboard switches to rearranging (iOS-style wobble, a light haptic tap)
 * and the widget follows the pointer with a bounce. Neighbours make room as
 * it moves; on release it bounces into place and the new order is saved.
 * While rearranging, widgets move right away (touch: after a short hold,
 * so swipes still scroll), "−" hides a widget (with Undo), the grip button
 * moves one with the keyboard, and Done / Escape finishes.
 */
export function DashboardWidgets({
  editing,
  onEditingChange,
  className,
}: DashboardWidgetsProps) {
  const { t } = useI18n();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const widgets = useDashboardLayoutStore((s) => s.widgets);
  const isHydrated = useDashboardLayoutStore((s) => s.isHydrated);
  const saveErrors = useDashboardLayoutStore((s) => s.saveErrors);
  const load = useDashboardLayoutStore((s) => s.load);
  const reorderVisible = useDashboardLayoutStore((s) => s.reorderVisible);
  const setVisible = useDashboardLayoutStore((s) => s.setVisible);
  const replace = useDashboardLayoutStore((s) => s.replace);

  useEffect(() => {
    void load(userId);
  }, [load, userId]);

  // A failed save was reverted by the store: say so.
  const seenErrors = useRef(saveErrors);
  useEffect(() => {
    if (saveErrors > seenErrors.current) {
      toast.error(t("dashboard.layout.saveFailed"));
    }
    seenErrors.current = saveErrors;
  }, [saveErrors, t]);

  const visible = useMemo(() => visibleWidgetIds(widgets), [widgets]);

  // ── Dragging ────────────────────────────────────────────────────────
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<DashboardWidgetId | null>(null);
  const [snapshot, setSnapshot] = useState<HTMLElement | null>(null);
  /** Live order while dragging; `null` = the store's order. */
  const [dragOrder, setDragOrder] = useState<DashboardWidgetId[] | null>(null);
  const dragOrderRef = useRef<DashboardWidgetId[] | null>(null);
  /** Widget the last arrow key moved to (keyboard drags). */
  const keyboardTarget = useRef<DashboardWidgetId | null>(null);
  /** Last widget swapped with, and where the drag was then. */
  const lastSwap = useRef<{
    /** Cleared once the pointer leaves that widget. */
    id: UniqueIdentifier | null;
    x: number;
    y: number;
  } | null>(null);
  const items = dragOrder ?? visible;

  const setOrder = (order: DashboardWidgetId[] | null) => {
    dragOrderRef.current = order;
    setDragOrder(order);
  };

  const mouseOptions = useMemo(
    () => ({
      activationConstraint: editing
        ? { distance: EDIT_MOUSE_DISTANCE_PX }
        : { delay: LONG_PRESS_MS, tolerance: LONG_PRESS_TOLERANCE_PX },
    }),
    [editing],
  );
  const touchOptions = useMemo(
    () => ({
      activationConstraint: {
        delay: editing ? EDIT_TOUCH_DELAY_MS : LONG_PRESS_MS,
        tolerance: LONG_PRESS_TOLERANCE_PX,
      },
    }),
    [editing],
  );
  const keyboardOptions = useMemo(() => {
    const coordinateGetter: KeyboardCoordinateGetter = (
      event,
      { active, context },
    ) => {
      const step = KEY_STEPS[event.code];
      if (!step) return undefined;
      event.preventDefault();
      const order = dragOrderRef.current ?? [];
      const target = order[order.indexOf(active as DashboardWidgetId) + step];
      const rect = target && context.droppableRects.get(target);
      if (!target || !rect) return undefined; // first/last: stays
      keyboardTarget.current = target;
      return { x: rect.left, y: rect.top };
    };
    return { coordinateGetter };
  }, []);
  const mouse = useSensor(WidgetMouseSensor, mouseOptions);
  const touch = useSensor(WidgetTouchSensor, touchOptions);
  // Only from a widget's grip button, shown while rearranging: Space in
  // the quick prompt types a space, it never picks up the widget.
  const keyboard = useSensor(WidgetKeyboardSensor, keyboardOptions);
  const sensors = useSensors(mouse, touch, keyboard);

  /**
   * Pointer: the widget under it (over a gap or an empty cell, nothing
   * moves). Keyboard: the widget the last arrow key chose.
   */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (args.pointerCoordinates) return pointerWithin(args);
    return [{ id: keyboardTarget.current ?? args.active.id }];
  }, []);

  const nameOf = useCallback(
    (id: UniqueIdentifier) => t(widgetMeta(id as DashboardWidgetId).nameKey),
    [t],
  );

  function onDragStart({ active }: DragStartEvent) {
    const id = active.id as DashboardWidgetId;
    const body = gridRef.current?.querySelector(
      `[data-widget-id="${id}"] [data-widget-body]`,
    );
    setSnapshot(body ? cloneForOverlay(body) : null);
    setOrder(visible);
    setActiveId(id);
    lastSwap.current = null;
    keyboardTarget.current = null;
    if (!editing) onEditingChange(true);
    navigator.vibrate?.(12);
  }

  /** Moves the dragged widget to `over`'s place (the grid reflows live). */
  function swap(active: UniqueIdentifier, over: UniqueIdentifier) {
    const order = dragOrderRef.current ?? visible;
    const from = order.indexOf(active as DashboardWidgetId);
    const to = order.indexOf(over as DashboardWidgetId);
    if (from < 0 || to < 0 || from === to) return false;
    setOrder(arrayMove(order, from, to));
    return true;
  }

  /**
   * Makes room for the dragged widget where it is. Runs when the widget
   * under the pointer changes and on every move, so holding still over a
   * widget that slid under the pointer swaps nothing, but moving on over
   * it does.
   */
  function swapWithOver({
    active,
    over,
    delta,
    activatorEvent,
  }: DragOverEvent | DragMoveEvent) {
    if (activatorEvent instanceof KeyboardEvent) {
      // One swap per arrow key: its target is used up, so the moves that
      // follow (scrolling it into view) can't swap it back.
      const target = keyboardTarget.current;
      if (!target || over?.id !== target) return;
      keyboardTarget.current = null;
      swap(active.id, target);
      return;
    }

    const last = lastSwap.current;
    // The neighbour just swapped with can still be under the pointer after
    // the reflow: no swapping back until the pointer has left it.
    if (last && over?.id !== last.id) last.id = null;
    if (!over || over.id === active.id) return;
    if (last) {
      if (over.id === last.id) return;
      // Only movement swaps, never the reflow of the previous swap.
      const moved = Math.hypot(delta.x - last.x, delta.y - last.y);
      if (moved < SWAP_DISTANCE_PX) return;
    }
    if (swap(active.id, over.id)) {
      lastSwap.current = { id: over.id, x: delta.x, y: delta.y };
    }
  }

  /** Where the widget was dropped (read by the announcement, which runs after). */
  const dropPosition = useRef(0);

  function finishDrag(id: UniqueIdentifier, commit: boolean) {
    const order = dragOrderRef.current;
    dropPosition.current = order
      ? order.indexOf(id as DashboardWidgetId) + 1
      : 0;
    if (commit && order) reorderVisible(order);
    setOrder(null);
    setActiveId(null);
    lastSwap.current = null;
    keyboardTarget.current = null;
  }

  const positionOf = (id: UniqueIdentifier) =>
    (dragOrderRef.current ?? visible).indexOf(id as DashboardWidgetId) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t("dashboard.layout.dnd.picked", { name: nameOf(active.id) }),
    // Over its own slot (e.g. right after picking it up): nothing moved,
    // and "Picked up …" must not be talked over.
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id
        ? t("dashboard.layout.dnd.over", {
            name: nameOf(active.id),
            position: positionOf(active.id),
            total: items.length,
          })
        : undefined,
    onDragEnd: ({ active }) =>
      t("dashboard.layout.dnd.dropped", {
        name: nameOf(active.id),
        position: dropPosition.current,
        total: items.length,
      }),
    onDragCancel: ({ active }) =>
      t("dashboard.layout.dnd.cancelled", { name: nameOf(active.id) }),
  };

  // ── Rearranging mode ────────────────────────────────────────────────
  useEffect(() => {
    if (!editing || activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEditingChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, activeId, onEditingChange]);

  const isEmpty = isHydrated && visible.length === 0;
  useEffect(() => {
    if (isEmpty && editing) onEditingChange(false);
  }, [isEmpty, editing, onEditingChange]);

  const hide = useCallback(
    (id: DashboardWidgetId) => {
      const before = useDashboardLayoutStore.getState().widgets;
      setVisible(id, false);
      toast(t("dashboard.layout.hidden", { name: nameOf(id) }), {
        action: {
          label: t("dashboard.layout.undo"),
          onClick: () => replace(before),
        },
      });
    },
    [setVisible, replace, t, nameOf],
  );

  if (isEmpty) {
    return (
      <EmptyState
        icon="🧩"
        title={t("dashboard.layout.emptyTitle")}
        description={t("dashboard.layout.emptyDescription")}
        actionLabel={t("dashboard.layout.addWidgets")}
        onAction={() => router.push(ADD_WIDGETS_HREF)}
        className={cn(
          "rounded-xl border border-dashed border-border",
          className,
        )}
      />
    );
  }

  return (
    <section
      aria-label={t("dashboard.widgets.region")}
      className={cn("space-y-4", className)}
    >
      {editing && <WidgetEditBar onDone={() => onEditingChange(false)} />}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable: t("dashboard.layout.dnd.instructions"),
          },
        }}
        onDragStart={onDragStart}
        onDragOver={swapWithOver}
        onDragMove={swapWithOver}
        onDragEnd={({ active }) => finishDrag(active.id, true)}
        onDragCancel={({ active }) => finishDrag(active.id, false)}
      >
        <SortableContext items={items} strategy={reflowStrategy}>
          <div
            ref={gridRef}
            className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-x-6"
          >
            {items.map((id, index) => (
              <SortableWidget
                key={id}
                id={id}
                index={index}
                editing={editing}
                ready={isHydrated}
                onHide={hide}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={dropAnimation} zIndex={80}>
          {activeId && snapshot ? <WidgetSnapshot node={snapshot} /> : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
