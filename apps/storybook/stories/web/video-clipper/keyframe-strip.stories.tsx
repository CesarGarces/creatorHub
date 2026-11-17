import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { KeyframeStrip } from "@/components/video-clipper/keyframe-strip";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import {
  CLIPPER_DURATION,
  CLIPPER_KEYFRAMES,
} from "../../fixtures/video-clipper";

const meta = {
  title: "Web/Video Clipper/KeyframeStrip",
  component: KeyframeStrip,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Compressed keyframes sampled in the browser (6–32, depending on the duration) — exactly what the vision model receives. Swipeable row (`data-scroll-x`); placeholders fill in while sampling. Clicking a frame seeks the player.",
      },
    },
  },
  argTypes: {
    frames: { description: "Keyframes sampled so far.", control: "object" },
    total: {
      description: "Keyframes planned for the video.",
      control: "number",
    },
    durationSec: {
      description: "Video duration (for the sampling interval).",
      control: "number",
    },
    activeTime: {
      description: "Player position: highlights the closest frame.",
      control: "number",
    },
    onSelect: {
      description: "A frame was clicked (seek).",
      table: { category: "Events" },
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
  args: {
    frames: CLIPPER_KEYFRAMES,
    total: CLIPPER_KEYFRAMES.length,
    durationSec: CLIPPER_DURATION,
    activeTime: 80,
    onSelect: fn(),
  },
} satisfies Meta<typeof KeyframeStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Sampling: Story = {
  args: { frames: CLIPPER_KEYFRAMES.slice(0, 7), activeTime: null },
};
export const Mobile: Story = { globals: viewport("mobileSmall") };
