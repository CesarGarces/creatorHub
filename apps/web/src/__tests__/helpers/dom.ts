import { screen } from "@testing-library/react";

/**
 * Finds the input/textarea rendered next to a visible label.
 *
 * The shared `Input`/`Textarea` components only associate the label when an
 * `id` is passed, and most callers don't — so `getByLabelText` can't find
 * these fields (an accessibility gap). This helper looks inside the label's
 * wrapper instead.
 */
export function fieldByLabel(
  text: string,
): HTMLInputElement | HTMLTextAreaElement {
  const label = screen.getByText(text, { selector: "label" });
  const field = label.parentElement?.querySelector("input, textarea");
  if (!field) throw new Error(`No field found next to label "${text}"`);
  return field as HTMLInputElement | HTMLTextAreaElement;
}
