import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { ClipCard } from "@/components/video-clipper/clip-card";
import { withWebApp } from "../../../.storybook/decorators/web";
import { viewport } from "../../../.storybook/viewports";
import {
  CLIPPER_DURATION,
  CLIPPER_HIGHLIGHTS,
} from "../../fixtures/video-clipper";

const clip = CLIPPER_HIGHLIGHTS[1]!;

const meta = {
  title: "Web/Video Clipper/ClipCard",
  component: ClipCard,
  decorators: [
    withWebApp,
    (Story) => (
      <div className="w-full max-w-md">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A detected highlight: score, time range, hook (copyable) and why it works. Each edge can be nudged by 1 s (the AI only saw keyframes); Preview plays the segment in the page player; Export records it in the browser and downloads it (progress + cancel). Buttons are 44px on touch screens.",
      },
    },
  },
  argTypes: {
    clip: {
      description: "The highlight from the analysis.",
      control: "object",
    },
    index: { description: "1-based position in the list.", control: "number" },
    range: {
      description: "Current in/out points (AI's or trimmed).",
      control: "object",
    },
    durationSec: {
      description: "Video duration (trim limit).",
      control: "number",
    },
    maxLength: {
      description: "Longest clip for the platform (trim limit).",
      control: "number",
    },
    active: {
      description: "Selected clip (highlighted border).",
      control: "boolean",
    },
    previewing: {
      description: "Being previewed (Preview → Stop).",
      control: "boolean",
    },
    canPlay: {
      description: "The original video is attached.",
      control: "boolean",
    },
    exportSupported: {
      description: "MediaRecorder export available.",
      control: "boolean",
    },
    exportState: {
      description: "`{ status, progress }` of the export.",
      control: "object",
    },
    exportLocked: {
      description: "Another clip is being exported.",
      control: "boolean",
    },
    onPreview: {
      description: "Preview pressed.",
      table: { category: "Events" },
    },
    onStop: { description: "Stop pressed.", table: { category: "Events" } },
    onExport: { description: "Export pressed.", table: { category: "Events" } },
    onCancelExport: {
      description: "Export cancelled.",
      table: { category: "Events" },
    },
    onRangeChange: {
      description: "An edge was nudged.",
      table: { category: "Events" },
    },
    onResetRange: {
      description: "Trim reset to the AI's range.",
      table: { category: "Events" },
    },
    onCopy: {
      description: "The hook was copied.",
      table: { category: "Events" },
    },
  },
  args: {
    clip,
    index: 2,
    range: { start: clip.start, end: clip.end },
    durationSec: CLIPPER_DURATION,
    maxLength: 60,
    active: true,
    previewing: false,
    canPlay: true,
    exportSupported: true,
    exportState: { status: "idle", progress: 0 },
    exportLocked: false,
    onPreview: fn(),
    onStop: fn(),
    onExport: fn(),
    onCancelExport: fn(),
    onRangeChange: fn(),
    onResetRange: fn(),
    onCopy: fn(),
  },
} satisfies Meta<typeof ClipCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Trimmed: Story = {
  args: { range: { start: clip.start + 2, end: clip.end - 3 } },
};
export const Exporting: Story = {
  args: { exportState: { status: "exporting", progress: 0.46 } },
};
export const WithoutVideo: Story = { args: { canPlay: false, active: false } };
export const Mobile: Story = { globals: viewport("mobileSmall") };
