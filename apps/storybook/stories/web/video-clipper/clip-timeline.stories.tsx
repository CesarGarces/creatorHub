import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ClipTimeline } from "@/components/video-clipper/clip-timeline";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import {
  CLIPPER_DURATION,
  CLIPPER_HIGHLIGHTS,
  CLIPPER_KEYFRAMES,
} from "../../fixtures/video-clipper";

const meta = {
  title: "Web/Video Clipper/ClipTimeline",
  component: ClipTimeline,
  decorators: [withWebApp],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The whole video as a bar with the detected clips as numbered segments (buttons: select = preview). The selected clip gets start/end handles (sliders): drag them with a mouse, finger or pen — 44px on touch screens, `touch-action: none` — or use the arrow keys (Shift = 0.1 s, Page Up/Down = 5 s, Home/End). Press and hold the selected clip (~0.4 s) until it lifts, then drag it to move it: it glides after the pointer and is committed on release (Escape puts it back). Shows the playhead and the keyframe positions the AI saw.",
      },
    },
  },
  argTypes: {
    durationSec: {
      description: "Video duration in seconds.",
      control: "number",
    },
    clips: {
      description: "Clips: `{ id, index, start, end, score }`.",
      control: "object",
    },
    activeId: {
      description: "Selected clip.",
      control: "select",
      options: [null, "h1", "h2", "h3"],
    },
    currentTime: {
      description: "Player position (playhead).",
      control: "number",
    },
    keyframes: {
      description: "Keyframe timestamps (ticks).",
      control: "object",
    },
    maxLength: {
      description: "Longest clip for the platform (limits the handles).",
      control: "number",
    },
    onSelect: {
      description: "A clip segment was clicked.",
      table: { category: "Events" },
    },
    onRangeChange: {
      description:
        "The selected clip was trimmed (handles) or moved (press and hold, then drag; committed on release). Without it, the clip is read-only.",
      table: { category: "Events" },
    },
    onScrub: {
      description: "Time under the moving handle (the page seeks the player).",
      table: { category: "Events" },
    },
    className: { description: "Extra classes on the root.", control: "text" },
  },
  args: {
    durationSec: CLIPPER_DURATION,
    clips: CLIPPER_HIGHLIGHTS.map((h, i) => ({ ...h, index: i + 1 })),
    activeId: "h2",
    currentTime: 84,
    keyframes: CLIPPER_KEYFRAMES.map((f) => f.timestamp),
    maxLength: 60,
    onSelect: fn(),
    onRangeChange: fn(),
    onScrub: fn(),
  },
} satisfies Meta<typeof ClipTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NothingSelected: Story = {
  args: { activeId: null, currentTime: null },
};
export const ReadOnly: Story = {
  name: "Read-only (no trimming)",
  args: { onRangeChange: undefined },
};
export const Mobile: Story = { globals: viewport("mobileSmall") };
