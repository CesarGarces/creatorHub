import type { MouseEvent, TouchEvent } from "react";
import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type Activators,
  type KeyboardSensorOptions,
  type MouseSensorOptions,
  type TouchSensorOptions,
} from "@dnd-kit/core";
import { canStartWidgetDrag } from "@/lib/dashboard-widgets/drag";

/**
 * dnd-kit's sensors, adapted to widgets.
 *
 * Mouse and touch: a press in a text field or on an element marked
 * `NO_WIDGET_DRAG` never picks the widget up.
 *
 * Mouse + touch (not the pointer sensor): on touch screens the page keeps
 * scrolling normally (no `touch-action: none` on whole widgets); once a
 * long press picks a widget up, the touch sensor stops the scroll itself.
 */
export class WidgetMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: (
        { nativeEvent: event }: MouseEvent,
        { onActivation }: MouseSensorOptions,
      ) => {
        if (event.button !== 0 || !canStartWidgetDrag(event.target)) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export class WidgetTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (
        { nativeEvent: event }: TouchEvent,
        { onActivation }: TouchSensorOptions,
      ) => {
        if (event.touches.length > 1 || !canStartWidgetDrag(event.target)) {
          return false;
        }
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

const [keyboardActivator] = KeyboardSensor.activators;

/**
 * Keyboard: only from the widget's own grip button (its activator node).
 * Outside rearranging there is no grip, so Space/Enter inside a widget
 * (e.g. typing in the quick prompt) never picks it up. The sensor stays
 * registered either way: the set of sensors must not change between
 * renders (dnd-kit sets them up in an effect keyed by the list).
 */
export class WidgetKeyboardSensor extends KeyboardSensor {
  static activators: Activators<KeyboardSensorOptions> = [
    {
      eventName: "onKeyDown",
      handler: (event, options, context) => {
        const grip = context.active.activatorNode.current;
        if (!grip || event.target !== grip) return false;
        return keyboardActivator!.handler(event, options, context);
      },
    },
  ];
}
