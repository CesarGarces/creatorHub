/**
 * Rearranging the dashboard (press and hold a widget, then drag it).
 *
 * Same feel as the clip timeline of the Video Clipper (§14f): hold ~0.4 s
 * without moving more than 8px. Moving first means "not a long press", so
 * taps, clicks, text selection and page scrolling keep working.
 */

/** Hold this long on a widget to pick it up (and start rearranging). */
export const LONG_PRESS_MS = 400;
/** Moving further before that cancels the long press (tap, scroll…). */
export const LONG_PRESS_TOLERANCE_PX = 8;
/**
 * While rearranging, a short hold still picks a widget up on touch screens
 * — a quick swipe scrolls the page instead of dragging the widget under it.
 */
export const EDIT_TOUCH_DELAY_MS = 150;
/** While rearranging, a mouse drags a widget after this many pixels. */
export const EDIT_MOUSE_DISTANCE_PX = 4;

/**
 * Marks an element whose presses must never pick the widget up (e.g. the
 * favorites' own drag handles). Spread it on the element.
 */
export const NO_WIDGET_DRAG = { "data-no-widget-drag": "" } as const;

const NOT_DRAGGABLE = [
  "input",
  "textarea",
  "select",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  "[data-no-widget-drag]",
].join(",");

/**
 * A press on this target may pick up the widget: not in a text field
 * (selecting text or placing the caret with a long press must work) and
 * not on an element marked with `NO_WIDGET_DRAG`.
 */
export function canStartWidgetDrag(target: EventTarget | null): boolean {
  return !(target instanceof Element && target.closest(NOT_DRAGGABLE));
}
