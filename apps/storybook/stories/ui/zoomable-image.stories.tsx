import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, waitFor, within } from "storybook/test";
import { ZoomableImage } from "@creator-hub/ui";
import { viewport } from "../../.storybook/viewports";

/** A 16:9 sample with detail worth zooming into. */
const SAMPLE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1a2236"/><stop offset="1" stop-color="#0b0f19"/>
      </linearGradient></defs>
      <rect width="1280" height="720" fill="url(#g)"/>
      <circle cx="640" cy="360" r="200" fill="#00bbd9" opacity="0.9"/>
      <text x="640" y="380" font-family="sans-serif" font-size="64" font-weight="700" text-anchor="middle" fill="#0b0f19">ZOOM ME</text>
      <text x="640" y="430" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#0b0f19">tiny details stay sharp when zoomed in</text>
    </svg>`,
  );

const meta = {
  title: "UI/Data display/ZoomableImage",
  component: ZoomableImage,
  parameters: {
    docs: {
      description: {
        component:
          "Image used by the asset preview and the public share page, with **Instagram-style pinch to zoom**: pinching the image lifts a copy of it above everything; it follows the fingers (scale and position) over the whole screen while the page behind fades into a blur. Releasing springs it back into place. No buttons. " +
          "Gestures that start on the image never zoom the page (`touch-action: pan-x pan-y` plus Safari's `gesture*` events) and one finger still scrolls; pinching anywhere else zooms the page as usual. On desktop a trackpad pinch or Ctrl + wheel does the same. With reduced motion the image returns without animation.",
      },
    },
  },
  argTypes: {
    src: { description: "Image URL.", control: "text" },
    alt: { description: "Alternative text of the image.", control: "text" },
    maxScale: {
      description: "Largest zoom factor while pinching.",
      control: { type: "range", min: 1.5, max: 8, step: 0.5 },
      table: { defaultValue: { summary: "4" } },
    },
    className: {
      description:
        "Classes of the `<img>` (size limits such as `max-h-[50dvh] object-contain`).",
      control: "text",
    },
    containerClassName: {
      description: "Classes of the frame around the image (e.g. `rounded-lg`).",
      control: "text",
    },
    onScaleChange: {
      description:
        "Called with the zoom factor whenever it changes (back to 1 on release).",
      table: { category: "Events" },
    },
    onZoomChange: {
      description:
        "Called with `true` when the zoom layer opens and `false` once the image is back in place.",
      table: { category: "Events" },
    },
  },
  args: {
    src: SAMPLE,
    alt: "Sample thumbnail",
    maxScale: 4,
    className: "max-w-full max-h-[70vh] object-contain",
    containerClassName: "rounded-lg overflow-hidden",
    onScaleChange: fn(),
    onZoomChange: fn(),
  },
} satisfies Meta<typeof ZoomableImage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Try a trackpad pinch (or Ctrl + wheel) on the image. */
export const Playground: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const frame = canvas.getByRole("group", { name: "Image viewer" });
    const box = frame.getBoundingClientRect();
    // A trackpad pinch arrives as Ctrl + wheel.
    const pinch = new WheelEvent("wheel", {
      deltaY: -60,
      ctrlKey: true,
      cancelable: true,
      bubbles: true,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    });
    frame.dispatchEvent(pinch);
    await expect(pinch.defaultPrevented).toBe(true);
    await waitFor(() => expect(frame).toHaveAttribute("data-zooming", "true"));
    await expect(args.onZoomChange).toHaveBeenCalledWith(true);
    await expect(
      canvasElement.ownerDocument.querySelector("[data-zoom-layer]"),
    ).not.toBeNull();
    // When the gesture stops, the image springs back and the layer goes.
    await waitFor(() => expect(frame).not.toHaveAttribute("data-zooming"));
    await expect(frame).toHaveAttribute("data-zoom-scale", "1.00");
    await expect(args.onZoomChange).toHaveBeenLastCalledWith(false);
  },
};

/** On a phone: pinch the image — it grows over a blurred page. */
export const Mobile: Story = {
  args: { className: "max-w-full max-h-[50dvh] object-contain" },
  globals: viewport("mobile"),
};

/** Inside page content, to see the blur over everything else. */
export const InPageContent: Story = {
  args: { className: "w-full max-h-[40vh] object-contain" },
  globals: viewport("mobile"),
  render: (args) => (
    <div className="space-y-3 p-4 text-sm text-text-muted">
      <p className="text-base font-semibold text-text">Gaming thumbnail</p>
      <p>Pinch the image: the text and the rest of the page blur behind it.</p>
      <ZoomableImage {...args} />
      <p>1280×720 · FLUX.1-schnell</p>
    </div>
  ),
};
